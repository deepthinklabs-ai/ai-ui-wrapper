/**
 * SSM Server-Side Encryption
 *
 * Encrypts and decrypts SSM operational data (rules, auto-reply, polling settings)
 * using a server-managed key from Secret Manager.
 *
 * This encryption is separate from user password-based encryption:
 * - Password-encrypted: Zero-knowledge content (threads, system prompts)
 * - Server-encrypted: Hosted automation data (SSM rules, OAuth tokens)
 *
 * Security Requirements:
 * - Key from Secret Manager (not plaintext env)
 * - AES-256-GCM authenticated encryption
 * - No plaintext logging of config data
 * - Unique IV per encryption operation
 */

import * as crypto from 'crypto';
import { getSSMServerKey } from './secretManager/ssmServerKey';

// Encryption constants
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16;

// Output format: base64(iv + authTag + ciphertext)

/**
 * Encrypt SSM server config
 *
 * @param config - The config object to encrypt (will be JSON stringified)
 * @returns Base64-encoded encrypted string
 *
 * Format: base64(iv[12] + authTag[16] + ciphertext[...])
 */
export async function encryptSSMServerConfig<T>(config: T): Promise<string> {
  // Get key from Secret Manager
  const key = await getSSMServerKey();

  // Generate random IV
  const iv = crypto.randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  // Encrypt the JSON config
  const jsonString = JSON.stringify(config);
  const encrypted = Buffer.concat([
    cipher.update(jsonString, 'utf8'),
    cipher.final(),
  ]);

  // Get auth tag
  const authTag = cipher.getAuthTag();

  // Combine: iv + authTag + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);

  // Return as base64
  return combined.toString('base64');
}

/**
 * Decrypt SSM server config
 *
 * @param encrypted - Base64-encoded encrypted string
 * @returns Decrypted config object
 * @throws Error if decryption fails (invalid data or tampered)
 */
export async function decryptSSMServerConfig<T>(encrypted: string): Promise<T> {
  // Get key from Secret Manager
  const key = await getSSMServerKey();

  // Decode base64
  const combined = Buffer.from(encrypted, 'base64');

  // Validate minimum length: IV + authTag + at least 1 byte of ciphertext
  const minLength = IV_LENGTH + AUTH_TAG_LENGTH + 1;
  if (combined.length < minLength) {
    throw new Error('Invalid encrypted data: too short');
  }

  // Extract components
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  // Create decipher
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  // Parse JSON
  const jsonString = decrypted.toString('utf8');
  return JSON.parse(jsonString) as T;
}

/**
 * Test encryption/decryption with a sample config
 * For development/testing only - never log actual configs
 */
export async function testSSMEncryption(): Promise<boolean> {
  const testConfig = {
    test: true,
    timestamp: new Date().toISOString(),
    nested: { value: 123 },
  };

  try {
    const encrypted = await encryptSSMServerConfig(testConfig);
    const decrypted = await decryptSSMServerConfig<typeof testConfig>(encrypted);

    const isValid =
      decrypted.test === testConfig.test &&
      decrypted.timestamp === testConfig.timestamp &&
      decrypted.nested.value === testConfig.nested.value;

    console.log('[SSM Encryption Test] Success:', isValid);
    return isValid;
  } catch (error) {
    console.error('[SSM Encryption Test] Failed:', error);
    return false;
  }
}
