/**
 * @security-audit-requested
 * AUDIT FOCUS: OAuth token encryption and storage
 * - Is CryptoJS.AES sufficient for token encryption (vs native crypto)? ✅ FIXED - using native crypto
 * - Is the ENCRYPTION_KEY properly derived (should use PBKDF2)? ✅ FIXED - using PBKDF2
 * - Are decrypted tokens cleared from memory after use?
 * - Can timing attacks reveal token validity?
 * - Is the upsert operation vulnerable to race conditions?
 * - Are revoked tokens properly invalidated everywhere?
 */

/**
 * Google OAuth Token Storage
 * Handles secure encryption, storage, and retrieval of OAuth tokens
 */

import { createClient } from '@supabase/supabase-js';
import { refreshAccessToken, type GoogleOAuthTokens } from './googleOAuth';
import { randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv } from 'crypto';

// Server-side Supabase client
const getSupabaseAdmin = () => {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
};

const ENCRYPTION_KEY = process.env.OAUTH_ENCRYPTION_KEY!;

if (!ENCRYPTION_KEY) {
  throw new Error('OAUTH_ENCRYPTION_KEY environment variable is required');
}

// SECURITY: Constants for AES-256-GCM encryption
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits for GCM
const SALT_LENGTH = 32;
const KEY_LENGTH = 32; // 256 bits
const AUTH_TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 100000;

/**
 * Derive encryption key using PBKDF2
 * SECURITY: Proper key derivation prevents weak key attacks
 */
function deriveKey(salt: Buffer): Buffer {
  return pbkdf2Sync(ENCRYPTION_KEY, salt, PBKDF2_ITERATIONS, KEY_LENGTH, 'sha256');
}

/**
 * Encrypt a token using AES-256-GCM with proper key derivation
 * SECURITY: Uses authenticated encryption to prevent tampering
 * Format: base64(salt + iv + authTag + ciphertext)
 */
function encryptToken(token: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const key = deriveKey(salt);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(token, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();

  // Combine salt + iv + authTag + ciphertext
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);
  return combined.toString('base64');
}

/**
 * Decrypt a token using AES-256-GCM
 * SECURITY: Verifies authenticity before decryption
 */
export function decryptToken(encryptedToken: string): string {
  const combined = Buffer.from(encryptedToken, 'base64');

  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  const key = deriveKey(salt);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}

export type OAuthConnection = {
  id: string;
  user_id: string;
  provider: string;
  provider_user_id: string;
  provider_email: string;
  provider_name: string | null;
  provider_picture: string | null;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  scopes: string[];
  status: 'active' | 'revoked' | 'expired';
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
};

/**
 * Store OAuth tokens in database (encrypted)
 */
export async function storeOAuthTokens(
  userId: string,
  provider: 'google',
  tokens: GoogleOAuthTokens,
  userInfo: {
    id: string;
    email: string;
    name: string;
    picture: string;
  }
): Promise<OAuthConnection> {
  const supabase = getSupabaseAdmin();

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const connectionData = {
    user_id: userId,
    provider,
    provider_user_id: userInfo.id,
    provider_email: userInfo.email,
    provider_name: userInfo.name,
    provider_picture: userInfo.picture,
    access_token_encrypted: encryptToken(tokens.access_token),
    refresh_token_encrypted: encryptToken(tokens.refresh_token),
    token_expires_at: expiresAt,
    scopes: tokens.scope.split(' '),
    status: 'active' as const,
    updated_at: new Date().toISOString(),
  };

  // Upsert (insert or update if exists)
  const { data, error } = await supabase
    .from('oauth_connections')
    .upsert(connectionData, {
      onConflict: 'user_id,provider',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to store OAuth tokens: ${error.message}`);
  }

  return data;
}

/**
 * Get OAuth connection for a user
 */
export async function getOAuthConnection(
  userId: string,
  provider: 'google'
): Promise<OAuthConnection | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('oauth_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', provider)
    .eq('status', 'active')
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Get valid access token (refreshes if expired)
 */
export async function getValidAccessToken(
  userId: string,
  provider: 'google' = 'google'
): Promise<string | null> {
  const supabase = getSupabaseAdmin();

  const connection = await getOAuthConnection(userId, provider);

  if (!connection) {
    return null;
  }

  const now = new Date();
  const expiresAt = new Date(connection.token_expires_at);

  // Token is still valid (with 5-minute buffer)
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return decryptToken(connection.access_token_encrypted);
  }

  // Token expired, refresh it
  try {
    const refreshToken = decryptToken(connection.refresh_token_encrypted);
    const newTokens = await refreshAccessToken(refreshToken);

    // Update stored tokens
    const newExpiresAt = new Date(Date.now() + newTokens.expires_in * 1000).toISOString();

    await supabase
      .from('oauth_connections')
      .update({
        access_token_encrypted: encryptToken(newTokens.access_token),
        token_expires_at: newExpiresAt,
        updated_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    return newTokens.access_token;
  } catch (error) {
    console.error('Failed to refresh token:', error);

    // Mark connection as expired
    await supabase
      .from('oauth_connections')
      .update({
        status: 'expired',
        updated_at: new Date().toISOString(),
      })
      .eq('id', connection.id);

    return null;
  }
}

/**
 * Revoke OAuth connection
 */
export async function revokeOAuthConnection(
  userId: string,
  provider: 'google'
): Promise<void> {
  const supabase = getSupabaseAdmin();

  await supabase
    .from('oauth_connections')
    .update({
      status: 'revoked',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', provider);
}

/**
 * Delete OAuth connection permanently
 */
export async function deleteOAuthConnection(
  userId: string,
  provider: 'google'
): Promise<void> {
  const supabase = getSupabaseAdmin();

  await supabase
    .from('oauth_connections')
    .delete()
    .eq('user_id', userId)
    .eq('provider', provider);
}

/**
 * Update last used timestamp
 */
export async function updateLastUsed(connectionId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  await supabase
    .from('oauth_connections')
    .update({
      last_used_at: new Date().toISOString(),
    })
    .eq('id', connectionId);
}
