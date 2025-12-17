/**
 * Slack OAuth Token Storage
 * Handles secure encryption, storage, and retrieval of Slack bot tokens
 */

import { createClient } from '@supabase/supabase-js';
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
function decryptToken(encryptedToken: string): string {
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

export type SlackOAuthConnection = {
  id: string;
  user_id: string;
  provider: 'slack';
  provider_user_id: string;  // Bot user ID
  provider_email: string;    // Workspace name (no email for bots)
  provider_name: string | null;  // Team name
  provider_picture: string | null;
  access_token_encrypted: string;
  refresh_token_encrypted: string;  // Empty for Slack bot tokens
  token_expires_at: string;  // Far future for bot tokens
  scopes: string[];
  status: 'active' | 'revoked' | 'expired';
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  // Slack-specific metadata stored in a way compatible with existing schema
  metadata?: {
    team_id: string;
    team_name: string;
    bot_user_id: string;
    app_id: string;
  };
};

/**
 * Slack OAuth response from oauth.v2.access
 */
export interface SlackOAuthResponse {
  ok: boolean;
  access_token: string;
  token_type: 'bot';
  scope: string;
  bot_user_id: string;
  app_id: string;
  team: {
    id: string;
    name: string;
  };
  authed_user?: {
    id: string;
  };
  error?: string;
}

/**
 * Store Slack OAuth tokens in database (encrypted)
 */
export async function storeSlackTokens(
  userId: string,
  tokens: SlackOAuthResponse
): Promise<SlackOAuthConnection> {
  const supabase = getSupabaseAdmin();

  // Slack bot tokens don't expire - set far future date
  const farFuture = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 10).toISOString(); // 10 years

  const connectionData = {
    user_id: userId,
    provider: 'slack',
    provider_user_id: tokens.bot_user_id,
    provider_email: tokens.team.name,  // Store workspace name in email field for display
    provider_name: tokens.team.name,
    provider_picture: null,  // Could fetch workspace icon later
    access_token_encrypted: encryptToken(tokens.access_token),
    refresh_token_encrypted: encryptToken(''),  // No refresh token for Slack bots
    token_expires_at: farFuture,
    scopes: tokens.scope.split(','),
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
    throw new Error(`Failed to store Slack tokens: ${error.message}`);
  }

  return data;
}

/**
 * Get Slack OAuth connection for a user
 */
export async function getSlackConnection(
  userId: string
): Promise<SlackOAuthConnection | null> {
  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('oauth_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'slack')
    .eq('status', 'active')
    .single();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Get Slack bot token (no refresh needed for bot tokens)
 */
export async function getSlackBotToken(
  userId: string
): Promise<string | null> {
  const connection = await getSlackConnection(userId);

  if (!connection) {
    return null;
  }

  return decryptToken(connection.access_token_encrypted);
}

/**
 * Revoke Slack OAuth connection
 */
export async function revokeSlackConnection(
  userId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();

  await supabase
    .from('oauth_connections')
    .update({
      status: 'revoked',
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('provider', 'slack');
}

/**
 * Delete Slack OAuth connection permanently
 */
export async function deleteSlackConnection(
  userId: string
): Promise<void> {
  const supabase = getSupabaseAdmin();

  await supabase
    .from('oauth_connections')
    .delete()
    .eq('user_id', userId)
    .eq('provider', 'slack');
}

/**
 * Update last used timestamp
 */
export async function updateSlackLastUsed(connectionId: string): Promise<void> {
  const supabase = getSupabaseAdmin();

  await supabase
    .from('oauth_connections')
    .update({
      last_used_at: new Date().toISOString(),
    })
    .eq('id', connectionId);
}
