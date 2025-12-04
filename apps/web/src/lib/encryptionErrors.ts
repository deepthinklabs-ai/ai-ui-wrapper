/**
 * Encryption Error Handling
 *
 * Provides structured error types for encryption operations,
 * enabling better debugging and proper error propagation.
 */

/**
 * Error codes for encryption operations
 */
export type EncryptionErrorCode =
  | 'LOCKED'           // Encryption is set up but not unlocked
  | 'NOT_SETUP'        // Encryption has not been set up yet
  | 'WRONG_PASSWORD'   // Incorrect password provided
  | 'CORRUPTED_DATA'   // Data appears encrypted but cannot be decrypted
  | 'INVALID_FORMAT'   // Data format is invalid (not proper ciphertext)
  | 'KEY_MISMATCH'     // Data was encrypted with a different key
  | 'EXPORT_FAILED'    // Failed to export key for storage
  | 'IMPORT_FAILED'    // Failed to import key from storage
  | 'WRAP_FAILED'      // Failed to wrap/unwrap key
  | 'SESSION_EXPIRED'  // Session storage key is no longer valid
  | 'RATE_LIMITED'     // Too many failed attempts
  | 'UNKNOWN';         // Unknown error

/**
 * Structured encryption error with code for programmatic handling
 */
export class EncryptionError extends Error {
  public readonly code: EncryptionErrorCode;
  public readonly originalError?: Error;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: Date;

  constructor(
    code: EncryptionErrorCode,
    message: string,
    options?: {
      originalError?: Error;
      context?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = 'EncryptionError';
    this.code = code;
    this.originalError = options?.originalError;
    this.context = options?.context;
    this.timestamp = new Date();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, EncryptionError);
    }
  }

  /**
   * Check if this error indicates user action is required
   */
  requiresUserAction(): boolean {
    return ['LOCKED', 'WRONG_PASSWORD', 'RATE_LIMITED'].includes(this.code);
  }

  /**
   * Check if this error indicates data corruption
   */
  isDataCorruption(): boolean {
    return ['CORRUPTED_DATA', 'INVALID_FORMAT', 'KEY_MISMATCH'].includes(this.code);
  }

  /**
   * Check if this error is recoverable by retry
   */
  isRetryable(): boolean {
    return ['SESSION_EXPIRED', 'UNKNOWN'].includes(this.code);
  }

  /**
   * Get a user-friendly message for display
   */
  getUserMessage(): string {
    switch (this.code) {
      case 'LOCKED':
        return 'Please unlock your encryption to view this content.';
      case 'NOT_SETUP':
        return 'Encryption has not been set up yet.';
      case 'WRONG_PASSWORD':
        return 'Incorrect password. Please try again.';
      case 'CORRUPTED_DATA':
        return 'This data appears to be corrupted and cannot be decrypted.';
      case 'INVALID_FORMAT':
        return 'Invalid data format encountered.';
      case 'KEY_MISMATCH':
        return 'This data was encrypted with a different key.';
      case 'EXPORT_FAILED':
      case 'IMPORT_FAILED':
      case 'WRAP_FAILED':
        return 'An error occurred with key management. Please try again.';
      case 'SESSION_EXPIRED':
        return 'Your session has expired. Please unlock your encryption again.';
      case 'RATE_LIMITED':
        return 'Too many failed attempts. Please wait before trying again.';
      default:
        return 'An encryption error occurred. Please try again.';
    }
  }

  /**
   * Serialize for logging
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      originalError: this.originalError?.message,
    };
  }
}

/**
 * Type guard to check if an error is an EncryptionError
 */
export function isEncryptionError(error: unknown): error is EncryptionError {
  return error instanceof EncryptionError;
}

/**
 * Create an EncryptionError from an unknown error
 */
export function toEncryptionError(
  error: unknown,
  defaultCode: EncryptionErrorCode = 'UNKNOWN'
): EncryptionError {
  if (isEncryptionError(error)) {
    return error;
  }

  if (error instanceof Error) {
    // Try to infer code from error message
    const message = error.message.toLowerCase();
    let code: EncryptionErrorCode = defaultCode;

    if (message.includes('not unlocked') || message.includes('locked')) {
      code = 'LOCKED';
    } else if (message.includes('password') || message.includes('incorrect')) {
      code = 'WRONG_PASSWORD';
    } else if (message.includes('corrupt') || message.includes('decrypt')) {
      code = 'CORRUPTED_DATA';
    } else if (message.includes('format') || message.includes('invalid')) {
      code = 'INVALID_FORMAT';
    }

    return new EncryptionError(code, error.message, { originalError: error });
  }

  return new EncryptionError(
    defaultCode,
    typeof error === 'string' ? error : 'Unknown encryption error'
  );
}
