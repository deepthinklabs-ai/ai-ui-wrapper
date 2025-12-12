/**
 * Google Secret Manager Client for BYOK
 *
 * Manages user API keys securely in Google Cloud Secret Manager.
 * Keys are stored as a JSON blob per user with all provider keys.
 *
 * Authentication:
 * - Production (Vercel): Uses Workload Identity Federation via GOOGLE_APPLICATION_CREDENTIALS
 * - Local development: Uses base64-encoded service account key via GCP_SERVICE_ACCOUNT_KEY
 *
 * Security Requirements:
 * - Keys are NEVER logged
 * - Keys are NEVER returned to frontend
 * - Keys exist in memory only during API calls
 * - All operations require authenticated user
 */

import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Provider types supported
export type BYOKProvider = 'openai' | 'claude' | 'grok' | 'gemini';

// JSON blob structure stored in Secret Manager
export interface UserApiKeys {
  openai: string | null;
  claude: string | null;
  grok: string | null;
  gemini: string | null;
}

// Empty keys template
const EMPTY_KEYS: UserApiKeys = {
  openai: null,
  claude: null,
  grok: null,
  gemini: null,
};

// Singleton client instance
let client: SecretManagerServiceClient | null = null;

/**
 * Initialize the Secret Manager client
 *
 * Supports two authentication methods:
 * 1. Workload Identity Federation (Vercel production) - uses GCP_WIF_CONFIG env var
 * 2. Service Account Key (local dev) - uses GCP_SERVICE_ACCOUNT_KEY env var
 */
function getClient(): SecretManagerServiceClient {
  if (client) return client;

  // Method 1: Workload Identity Federation (for Vercel)
  const wifConfig = process.env.GCP_WIF_CONFIG;
  if (wifConfig) {
    try {
      // Write WIF config to a temp file (required by Google Auth library)
      const tempDir = os.tmpdir();
      const configPath = path.join(tempDir, 'gcp-wif-config.json');
      fs.writeFileSync(configPath, wifConfig, 'utf-8');

      // Set the environment variable that Google libraries look for
      process.env.GOOGLE_APPLICATION_CREDENTIALS = configPath;

      // Create client - it will automatically use the WIF config
      client = new SecretManagerServiceClient();
      return client;
    } catch (error) {
      console.error('Failed to initialize WIF client:', error);
      throw new Error('Failed to initialize Secret Manager client with WIF');
    }
  }

  // Method 2: Service Account Key (for local development)
  const serviceAccountKey = process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    try {
      const credentials = JSON.parse(
        Buffer.from(serviceAccountKey, 'base64').toString('utf-8')
      );

      client = new SecretManagerServiceClient({ credentials });
      return client;
    } catch {
      throw new Error('Failed to initialize Secret Manager client with service account key');
    }
  }

  throw new Error('No GCP credentials configured. Set either GCP_WIF_CONFIG (for Vercel) or GCP_SERVICE_ACCOUNT_KEY (for local dev)');
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
 * Generate secret name for a user
 * Format: aiuiw-user-{userId}
 */
export function getUserSecretName(userId: string): string {
  // Sanitize userId to be safe for secret names (alphanumeric, hyphens, underscores)
  const sanitizedId = userId.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `aiuiw-user-${sanitizedId}`;
}

/**
 * Get full secret path for GCP
 */
function getSecretPath(userId: string): string {
  return `projects/${getProjectId()}/secrets/${getUserSecretName(userId)}`;
}

/**
 * Get latest version path for a secret
 */
function getLatestVersionPath(userId: string): string {
  return `${getSecretPath(userId)}/versions/latest`;
}

/**
 * Check if a secret exists for a user
 */
export async function secretExists(userId: string): Promise<boolean> {
  const secretManager = getClient();
  const secretPath = getSecretPath(userId);

  try {
    await secretManager.getSecret({ name: secretPath });
    return true;
  } catch (error: unknown) {
    const grpcError = error as { code?: number };
    // 5 = NOT_FOUND in gRPC status codes
    if (grpcError.code === 5) {
      return false;
    }
    throw error;
  }
}

/**
 * Create a new secret for a user
 */
async function createSecret(userId: string): Promise<void> {
  const secretManager = getClient();
  const projectId = getProjectId();
  const secretId = getUserSecretName(userId);

  await secretManager.createSecret({
    parent: `projects/${projectId}`,
    secretId,
    secret: {
      replication: {
        automatic: {},
      },
      labels: {
        'app': 'aiuiw',
        'type': 'byok',
      },
    },
  });
}

/**
 * Add a new version to an existing secret
 */
async function addSecretVersion(userId: string, data: UserApiKeys): Promise<void> {
  const secretManager = getClient();
  const secretPath = getSecretPath(userId);

  // Convert to JSON and encode
  const payload = Buffer.from(JSON.stringify(data), 'utf-8');

  await secretManager.addSecretVersion({
    parent: secretPath,
    payload: {
      data: payload,
    },
  });
}

/**
 * Get user's API keys from Secret Manager
 * Returns empty keys object if no secret exists
 */
export async function getUserKeys(userId: string): Promise<UserApiKeys> {
  const secretManager = getClient();
  const versionPath = getLatestVersionPath(userId);

  try {
    const [version] = await secretManager.accessSecretVersion({ name: versionPath });

    if (!version.payload?.data) {
      return { ...EMPTY_KEYS };
    }

    const data = version.payload.data;
    const jsonString = typeof data === 'string'
      ? data
      : Buffer.from(data as Uint8Array).toString('utf-8');

    const parsed = JSON.parse(jsonString) as Partial<UserApiKeys>;

    // Ensure all fields exist
    return {
      openai: parsed.openai || null,
      claude: parsed.claude || null,
      grok: parsed.grok || null,
      gemini: parsed.gemini || null,
    };
  } catch (error: unknown) {
    const grpcError = error as { code?: number };
    // 5 = NOT_FOUND - secret doesn't exist yet
    if (grpcError.code === 5) {
      return { ...EMPTY_KEYS };
    }
    throw error;
  }
}

/**
 * Update a single provider's API key
 * Uses merge-and-replace pattern: fetch existing, update field, write back
 */
export async function updateUserKey(
  userId: string,
  provider: BYOKProvider,
  apiKey: string
): Promise<void> {
  // Check if secret exists, create if not
  const exists = await secretExists(userId);
  if (!exists) {
    await createSecret(userId);
  }

  // Get existing keys
  const currentKeys = await getUserKeys(userId);

  // Update the specific provider
  const updatedKeys: UserApiKeys = {
    ...currentKeys,
    [provider]: apiKey,
  };

  // Write back entire blob as new version
  await addSecretVersion(userId, updatedKeys);

  // Security: null out local variables
  // (JavaScript GC will handle, but explicit for clarity)
  updatedKeys[provider] = null;
}

/**
 * Delete a single provider's API key
 * Sets the provider's key to null and writes new version
 */
export async function deleteUserKey(
  userId: string,
  provider: BYOKProvider
): Promise<void> {
  const exists = await secretExists(userId);
  if (!exists) {
    // Nothing to delete
    return;
  }

  const currentKeys = await getUserKeys(userId);

  // Set provider key to null
  const updatedKeys: UserApiKeys = {
    ...currentKeys,
    [provider]: null,
  };

  await addSecretVersion(userId, updatedKeys);
}

/**
 * Delete all API keys for a user
 * Deletes the entire secret
 */
export async function deleteAllUserKeys(userId: string): Promise<void> {
  const secretManager = getClient();
  const secretPath = getSecretPath(userId);

  try {
    await secretManager.deleteSecret({ name: secretPath });
  } catch (error: unknown) {
    const grpcError = error as { code?: number };
    // Ignore NOT_FOUND errors
    if (grpcError.code !== 5) {
      throw error;
    }
  }
}

/**
 * Get status of which providers have keys configured
 * Returns boolean for each provider, never the actual keys
 */
export async function getUserKeyStatus(userId: string): Promise<Record<BYOKProvider, boolean>> {
  const keys = await getUserKeys(userId);

  return {
    openai: keys.openai !== null && keys.openai.length > 0,
    claude: keys.claude !== null && keys.claude.length > 0,
    grok: keys.grok !== null && keys.grok.length > 0,
    gemini: keys.gemini !== null && keys.gemini.length > 0,
  };
}

/**
 * Check if user has at least one API key configured
 */
export async function hasAnyKey(userId: string): Promise<boolean> {
  const status = await getUserKeyStatus(userId);
  return status.openai || status.claude || status.grok || status.gemini;
}
