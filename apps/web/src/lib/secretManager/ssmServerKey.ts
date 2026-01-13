/**
 * SSM Server Key Management
 *
 * Retrieves the SSM server encryption key from Google Secret Manager.
 * This key is used to encrypt SSM operational data (rules, auto-reply, polling settings)
 * that needs to be accessible by server-side cron jobs for background polling.
 *
 * Security:
 * - Key is stored in Secret Manager (not plaintext env)
 * - Key is NEVER logged
 * - Key exists in memory only during encryption/decryption operations
 * - Separate from user password-derived encryption (zero-knowledge content)
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { ExternalAccountClient } from 'google-auth-library';
import { getVercelOidcToken } from '@vercel/functions/oidc';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';

// Secret name for SSM server key
const SSM_SERVER_KEY_SECRET_NAME = 'aiuiw-ssm-server-key';

// Cached key for performance (only in memory)
let cachedKey: Buffer | null = null;
let cachedKeyExpiry: number = 0;
const KEY_CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

// Cached service account client (for local dev)
let cachedServiceAccountClient: SecretManagerServiceClient | null = null;

/**
 * Initialize the Secret Manager client
 * Supports WIF (Vercel) and service account key (local dev)
 */
async function getClient(): Promise<SecretManagerServiceClient> {
  // Check for Vercel WIF environment variables
  const projectNumber = process.env.GCLOUD_PROJECT_NUMBER;
  const poolId = process.env.GCLOUD_WORKLOAD_IDENTITY_POOL_ID;
  const providerId = process.env.GCLOUD_WORKLOAD_IDENTITY_POOL_PROVIDER_ID;
  const serviceAccountEmail = process.env.GCLOUD_SERVICE_ACCOUNT_EMAIL;

  // Method 1: Workload Identity Federation (for Vercel)
  if (projectNumber && poolId && providerId && serviceAccountEmail) {
    try {
      const oidcToken = await getVercelOidcToken();

      if (!oidcToken) {
        throw new Error('OIDC token not available - are you running on Vercel?');
      }

      // Write token to temp file (required by google-auth-library)
      const tokenPath = path.join(os.tmpdir(), `vercel-oidc-token-${crypto.randomUUID()}.txt`);
      fs.writeFileSync(tokenPath, oidcToken, { encoding: 'utf-8', mode: 0o600 });

      const authClient = ExternalAccountClient.fromJSON({
        type: 'external_account',
        audience: `//iam.googleapis.com/projects/${projectNumber}/locations/global/workloadIdentityPools/${poolId}/providers/${providerId}`,
        subject_token_type: 'urn:ietf:params:oauth:token-type:jwt',
        token_url: 'https://sts.googleapis.com/v1/token',
        service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${serviceAccountEmail}:generateAccessToken`,
        credential_source: {
          file: tokenPath,
          format: {
            type: 'text',
          },
        },
      });

      if (!authClient) {
        throw new Error('Failed to create auth client');
      }

      // Don't cache WIF client - token is per-request
      return new SecretManagerServiceClient({ authClient });
    } catch (error) {
      console.error('[SSM Server Key] Failed to initialize WIF client');
      throw new Error(`Failed to initialize Secret Manager client with WIF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Method 2: Service Account Key (for local development)
  const serviceAccountKey = process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    if (cachedServiceAccountClient) {
      return cachedServiceAccountClient;
    }

    try {
      const credentials = JSON.parse(
        Buffer.from(serviceAccountKey, 'base64').toString('utf-8')
      );

      cachedServiceAccountClient = new SecretManagerServiceClient({ credentials });
      return cachedServiceAccountClient;
    } catch {
      throw new Error('Failed to initialize Secret Manager client with service account key');
    }
  }

  throw new Error('No GCP credentials configured. Set GCLOUD_* env vars (for Vercel) or GCP_SERVICE_ACCOUNT_KEY (for local dev)');
}

/**
 * Get the GCP project ID from environment
 */
function getProjectId(): string {
  const projectId = process.env.GCP_PROJECT_ID;
  if (!projectId) {
    throw new Error('GCP_PROJECT_ID environment variable is not set');
  }
  return projectId;
}

/**
 * Get full secret path for the SSM server key
 */
function getSecretPath(): string {
  return `projects/${getProjectId()}/secrets/${SSM_SERVER_KEY_SECRET_NAME}/versions/latest`;
}

/**
 * Get the SSM server encryption key from Secret Manager
 *
 * Returns a 32-byte key suitable for AES-256-GCM encryption.
 * Key is cached in memory for performance (5 minute TTL).
 *
 * SECURITY: Key is NEVER logged
 */
export async function getSSMServerKey(): Promise<Buffer> {
  // Check cache first
  if (cachedKey && Date.now() < cachedKeyExpiry) {
    return cachedKey;
  }

  const secretManager = await getClient();
  const secretPath = getSecretPath();

  try {
    const [version] = await secretManager.accessSecretVersion({ name: secretPath });

    if (!version.payload?.data) {
      throw new Error('SSM server key secret is empty');
    }

    const data = version.payload.data;
    let keyString: string;

    if (typeof data === 'string') {
      keyString = data;
    } else {
      keyString = Buffer.from(data as Uint8Array).toString('utf-8');
    }

    // Key should be base64-encoded 32 bytes
    const keyBuffer = Buffer.from(keyString.trim(), 'base64');

    if (keyBuffer.length !== 32) {
      throw new Error(`SSM server key must be 32 bytes (got ${keyBuffer.length})`);
    }

    // Cache the key
    cachedKey = keyBuffer;
    cachedKeyExpiry = Date.now() + KEY_CACHE_DURATION_MS;

    // Log success without revealing key
    console.log('[SSM Server Key] Retrieved successfully');

    return keyBuffer;
  } catch (error: unknown) {
    const grpcError = error as { code?: number };
    if (grpcError.code === 5) {
      throw new Error(
        `SSM server key not found in Secret Manager. ` +
        `Create secret '${SSM_SERVER_KEY_SECRET_NAME}' with a base64-encoded 32-byte key.`
      );
    }
    throw error;
  }
}

/**
 * Clear the cached key (for testing or rotation)
 */
export function clearSSMServerKeyCache(): void {
  cachedKey = null;
  cachedKeyExpiry = 0;
}

/**
 * Generate a new SSM server key (for initial setup)
 * Returns base64-encoded 32-byte key to store in Secret Manager
 *
 * Usage:
 * 1. Run this function to generate a key
 * 2. Store the returned string in Secret Manager as 'aiuiw-ssm-server-key'
 *
 * SECURITY: Only use this during initial setup, never log the result
 */
export function generateSSMServerKey(): string {
  const key = crypto.randomBytes(32);
  return key.toString('base64');
}
