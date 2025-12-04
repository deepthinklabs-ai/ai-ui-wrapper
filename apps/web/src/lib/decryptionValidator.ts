/**
 * Decryption Validation Layer
 *
 * Provides structured validation for decryption operations,
 * distinguishing between plaintext, successful decryption,
 * and various failure modes.
 */

import { EncryptionError, EncryptionErrorCode } from './encryptionErrors';
import { isEncrypted } from './encryption';

/**
 * Result of a decryption validation attempt
 */
export type DecryptionResult<T = string> =
  | { status: 'success'; data: T }
  | { status: 'plaintext'; data: T }
  | { status: 'locked'; error: EncryptionError }
  | { status: 'corrupted'; error: EncryptionError }
  | { status: 'key_mismatch'; error: EncryptionError }
  | { status: 'error'; error: EncryptionError };

/**
 * Validate and perform decryption with structured result
 */
export async function validateDecryption(
  encryptedData: string,
  decryptFn: (data: string) => Promise<string>,
  context?: { itemId?: string; itemType?: string }
): Promise<DecryptionResult<string>> {
  // Check if data looks encrypted
  if (!isEncrypted(encryptedData)) {
    return { status: 'plaintext', data: encryptedData };
  }

  try {
    const data = await decryptFn(encryptedData);
    return { status: 'success', data };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const message = error.message.toLowerCase();

    // Categorize the error
    if (message.includes('not unlocked') || message.includes('locked')) {
      return {
        status: 'locked',
        error: new EncryptionError('LOCKED', 'Encryption is locked', {
          originalError: error,
          context,
        }),
      };
    }

    if (message.includes('tag') || message.includes('authentication')) {
      // GCM authentication tag failure usually means wrong key or corrupted data
      return {
        status: 'key_mismatch',
        error: new EncryptionError(
          'KEY_MISMATCH',
          'Data was encrypted with a different key',
          { originalError: error, context }
        ),
      };
    }

    if (message.includes('decrypt') || message.includes('invalid')) {
      return {
        status: 'corrupted',
        error: new EncryptionError(
          'CORRUPTED_DATA',
          'Failed to decrypt data - may be corrupted',
          { originalError: error, context }
        ),
      };
    }

    // Generic error
    return {
      status: 'error',
      error: new EncryptionError('UNKNOWN', error.message, {
        originalError: error,
        context,
      }),
    };
  }
}

/**
 * Validate and perform JSON decryption with structured result
 */
export async function validateJSONDecryption<T>(
  encryptedData: string,
  decryptFn: (data: string) => Promise<T>,
  context?: { itemId?: string; itemType?: string }
): Promise<DecryptionResult<T>> {
  // Check if data looks encrypted
  if (!isEncrypted(encryptedData)) {
    // Try to parse as JSON
    try {
      const parsed = JSON.parse(encryptedData) as T;
      return { status: 'plaintext', data: parsed };
    } catch {
      // Not valid JSON, return as-is (will be cast to T)
      return { status: 'plaintext', data: encryptedData as unknown as T };
    }
  }

  try {
    const data = await decryptFn(encryptedData);
    return { status: 'success', data };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    const message = error.message.toLowerCase();

    if (message.includes('not unlocked') || message.includes('locked')) {
      return {
        status: 'locked',
        error: new EncryptionError('LOCKED', 'Encryption is locked', {
          originalError: error,
          context,
        }),
      };
    }

    if (message.includes('tag') || message.includes('authentication')) {
      return {
        status: 'key_mismatch',
        error: new EncryptionError(
          'KEY_MISMATCH',
          'Data was encrypted with a different key',
          { originalError: error, context }
        ),
      };
    }

    return {
      status: 'corrupted',
      error: new EncryptionError(
        'CORRUPTED_DATA',
        'Failed to decrypt data - may be corrupted',
        { originalError: error, context }
      ),
    };
  }
}

/**
 * Check if a decryption result indicates success (including plaintext)
 */
export function isDecryptionSuccess<T>(
  result: DecryptionResult<T>
): result is { status: 'success'; data: T } | { status: 'plaintext'; data: T } {
  return result.status === 'success' || result.status === 'plaintext';
}

/**
 * Check if a decryption result indicates an error
 */
export function isDecryptionError<T>(
  result: DecryptionResult<T>
): result is
  | { status: 'locked'; error: EncryptionError }
  | { status: 'corrupted'; error: EncryptionError }
  | { status: 'key_mismatch'; error: EncryptionError }
  | { status: 'error'; error: EncryptionError } {
  return ['locked', 'corrupted', 'key_mismatch', 'error'].includes(result.status);
}

/**
 * Extract data from a successful decryption result, or return fallback
 */
export function getDecryptedDataOrFallback<T>(
  result: DecryptionResult<T>,
  fallback: T
): T {
  if (isDecryptionSuccess(result)) {
    return result.data;
  }
  return fallback;
}
