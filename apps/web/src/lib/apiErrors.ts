/**
 * Standardized API Error Responses
 *
 * Provides consistent error format across all API routes.
 * Integrates with EncryptionError for encryption-specific errors.
 *
 * Response format:
 * {
 *   error: {
 *     code: string,      // Machine-readable error code
 *     message: string,   // User-friendly message
 *     details?: any,     // Optional additional context (dev only)
 *   }
 * }
 */

import { NextResponse } from 'next/server';
import { EncryptionError, EncryptionErrorCode, isEncryptionError } from './encryptionErrors';

/**
 * Standard API error codes (non-encryption)
 */
export type APIErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'CONFLICT'
  | EncryptionErrorCode;

/**
 * API Error structure
 */
export interface APIError {
  code: APIErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

/**
 * API Error Response body
 */
export interface APIErrorResponse {
  error: APIError;
}

/**
 * HTTP status code mapping for error codes
 */
const ERROR_STATUS_CODES: Record<APIErrorCode, number> = {
  // Standard API errors
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 400,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  CONFLICT: 409,
  // Encryption errors
  LOCKED: 403,
  NOT_SETUP: 400,
  WRONG_PASSWORD: 401,
  CORRUPTED_DATA: 500,
  INVALID_FORMAT: 400,
  KEY_MISMATCH: 401,
  EXPORT_FAILED: 500,
  IMPORT_FAILED: 500,
  WRAP_FAILED: 500,
  SESSION_EXPIRED: 401,
  UNKNOWN: 500,
};

/**
 * Default user-friendly messages for error codes
 */
const DEFAULT_MESSAGES: Record<APIErrorCode, string> = {
  // Standard API errors
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'You do not have permission to access this resource',
  NOT_FOUND: 'The requested resource was not found',
  BAD_REQUEST: 'Invalid request',
  VALIDATION_ERROR: 'Validation failed',
  RATE_LIMITED: 'Too many requests. Please try again later.',
  INTERNAL_ERROR: 'An unexpected error occurred',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable',
  CONFLICT: 'Resource conflict',
  // Encryption errors
  LOCKED: 'Encryption is locked. Please unlock with your password.',
  NOT_SETUP: 'Encryption has not been set up for this account',
  WRONG_PASSWORD: 'Incorrect encryption password',
  CORRUPTED_DATA: 'Data appears to be corrupted',
  INVALID_FORMAT: 'Invalid data format',
  KEY_MISMATCH: 'Encryption key mismatch',
  EXPORT_FAILED: 'Failed to export encryption key',
  IMPORT_FAILED: 'Failed to import encryption key',
  WRAP_FAILED: 'Failed to wrap encryption key',
  SESSION_EXPIRED: 'Encryption session has expired',
  UNKNOWN: 'An unexpected encryption error occurred',
};

/**
 * Create a standardized API error response
 */
export function apiError(
  code: APIErrorCode,
  message?: string,
  details?: Record<string, unknown>
): NextResponse<APIErrorResponse> {
  const status = ERROR_STATUS_CODES[code] || 500;
  const errorMessage = message || DEFAULT_MESSAGES[code] || 'An error occurred';

  const response: APIErrorResponse = {
    error: {
      code,
      message: errorMessage,
    },
  };

  // Only include details in development
  if (details && process.env.NODE_ENV === 'development') {
    response.error.details = details;
  }

  return NextResponse.json(response, { status });
}

/**
 * Convert any error to a standardized API response
 */
export function handleAPIError(
  error: unknown,
  context?: string
): NextResponse<APIErrorResponse> {
  // Log the error
  console.error(`[API Error]${context ? ` ${context}:` : ''}`, error);

  // Handle EncryptionError
  if (isEncryptionError(error)) {
    return apiError(error.code, error.getUserMessage(), {
      originalMessage: error.message,
      context: error.context,
    });
  }

  // Handle standard Error
  if (error instanceof Error) {
    // Check for specific error patterns
    if (error.message.includes('rate limit') || error.message.includes('too many')) {
      return apiError('RATE_LIMITED');
    }
    if (error.message.includes('unauthorized') || error.message.includes('authentication')) {
      return apiError('UNAUTHORIZED');
    }
    if (error.message.includes('forbidden') || error.message.includes('permission')) {
      return apiError('FORBIDDEN');
    }
    if (error.message.includes('not found')) {
      return apiError('NOT_FOUND');
    }

    // Generic error with message
    return apiError('INTERNAL_ERROR', undefined, {
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }

  // Unknown error type
  return apiError('INTERNAL_ERROR');
}

/**
 * Shorthand helpers for common errors
 */
export const APIErrors = {
  unauthorized: (message?: string) => apiError('UNAUTHORIZED', message),
  forbidden: (message?: string) => apiError('FORBIDDEN', message),
  notFound: (message?: string) => apiError('NOT_FOUND', message),
  badRequest: (message?: string, details?: Record<string, unknown>) =>
    apiError('BAD_REQUEST', message, details),
  validation: (message: string, details?: Record<string, unknown>) =>
    apiError('VALIDATION_ERROR', message, details),
  rateLimited: (message?: string) => apiError('RATE_LIMITED', message),
  internal: (message?: string) => apiError('INTERNAL_ERROR', message),
  conflict: (message?: string) => apiError('CONFLICT', message),
} as const;

/**
 * Type guard to check if a response is an error response
 */
export function isAPIErrorResponse(response: unknown): response is APIErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof (response as APIErrorResponse).error === 'object' &&
    'code' in (response as APIErrorResponse).error &&
    'message' in (response as APIErrorResponse).error
  );
}
