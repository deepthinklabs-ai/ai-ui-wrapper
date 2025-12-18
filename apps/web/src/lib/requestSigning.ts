/**
 * Request Signing for Internal APIs
 *
 * Provides HMAC-SHA256 request signing to prevent tampering on internal API calls.
 * Implements replay protection with timestamp validation.
 *
 * Usage - Signing (client/caller):
 * ```ts
 * import { signRequest } from '@/lib/requestSigning';
 *
 * const { signature, timestamp, nonce } = await signRequest({
 *   method: 'POST',
 *   path: '/api/internal/action',
 *   body: JSON.stringify({ data: 'value' }),
 * });
 *
 * // Add headers to request
 * headers['X-Signature'] = signature;
 * headers['X-Timestamp'] = timestamp;
 * headers['X-Nonce'] = nonce;
 * ```
 *
 * Usage - Verification (server/receiver):
 * ```ts
 * import { verifyRequest } from '@/lib/requestSigning';
 *
 * const isValid = await verifyRequest(request);
 * if (!isValid.success) {
 *   return NextResponse.json({ error: isValid.error }, { status: 401 });
 * }
 * ```
 */

import { auditSecurity } from './auditLog';

// Configuration
const SIGNATURE_HEADER = 'X-Signature';
const TIMESTAMP_HEADER = 'X-Timestamp';
const NONCE_HEADER = 'X-Nonce';

// Maximum age of a request in milliseconds (5 minutes)
const MAX_REQUEST_AGE_MS = 5 * 60 * 1000;

// Nonce cache to prevent replay attacks (in-memory, consider Redis for production)
const usedNonces = new Map<string, number>();
const NONCE_CLEANUP_INTERVAL_MS = 60 * 1000; // Clean up every minute

// Clean up old nonces periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cutoff = Date.now() - MAX_REQUEST_AGE_MS;
    for (const [nonce, timestamp] of usedNonces.entries()) {
      if (timestamp < cutoff) {
        usedNonces.delete(nonce);
      }
    }
  }, NONCE_CLEANUP_INTERVAL_MS);
}

export interface SignRequestParams {
  method: string;
  path: string;
  body?: string;
  timestamp?: string;
  nonce?: string;
}

export interface SignedRequest {
  signature: string;
  timestamp: string;
  nonce: string;
}

export interface VerifyResult {
  success: boolean;
  error?: string;
  details?: {
    signatureValid: boolean;
    timestampValid: boolean;
    nonceValid: boolean;
  };
}

/**
 * Get the signing secret from environment
 */
function getSigningSecret(): string {
  const secret = process.env.INTERNAL_API_SIGNING_SECRET;
  if (!secret) {
    throw new Error('INTERNAL_API_SIGNING_SECRET is not configured');
  }
  return secret;
}

/**
 * Generate a cryptographically secure random nonce
 */
function generateNonce(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Create the string to sign from request components
 */
function createSignaturePayload(
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  body?: string
): string {
  // Normalize method to uppercase
  const normalizedMethod = method.toUpperCase();

  // Normalize path (remove query string for signing)
  const normalizedPath = path.split('?')[0];

  // Create canonical string
  const parts = [
    normalizedMethod,
    normalizedPath,
    timestamp,
    nonce,
  ];

  // Include body hash if present
  if (body && body.length > 0) {
    parts.push(body);
  }

  return parts.join('\n');
}

/**
 * Compute HMAC-SHA256 signature
 */
async function computeHMAC(payload: string, secret: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    // Web Crypto API (Edge runtime, browsers)
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const payloadData = encoder.encode(payload);

    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', key, payloadData);
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Node.js fallback
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require('crypto');
  return nodeCrypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
}

/**
 * Constant-time string comparison to prevent timing attacks
 */
function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Sign a request
 */
export async function signRequest(params: SignRequestParams): Promise<SignedRequest> {
  const secret = getSigningSecret();
  const timestamp = params.timestamp || Date.now().toString();
  const nonce = params.nonce || generateNonce();

  const payload = createSignaturePayload(
    params.method,
    params.path,
    timestamp,
    nonce,
    params.body
  );

  const signature = await computeHMAC(payload, secret);

  return {
    signature,
    timestamp,
    nonce,
  };
}

/**
 * Verify a signed request
 */
export async function verifyRequest(
  request: Request,
  options?: {
    /** Custom body to verify (useful if body was already consumed) */
    body?: string;
    /** Endpoint name for audit logging */
    endpoint?: string;
  }
): Promise<VerifyResult> {
  const headers = request.headers;
  const signature = headers.get(SIGNATURE_HEADER);
  const timestamp = headers.get(TIMESTAMP_HEADER);
  const nonce = headers.get(NONCE_HEADER);

  // Check required headers
  if (!signature || !timestamp || !nonce) {
    return {
      success: false,
      error: 'Missing signature headers',
      details: {
        signatureValid: false,
        timestampValid: !!timestamp,
        nonceValid: !!nonce,
      },
    };
  }

  // Validate timestamp (prevent replay attacks)
  const requestTime = parseInt(timestamp, 10);
  const now = Date.now();

  if (isNaN(requestTime) || Math.abs(now - requestTime) > MAX_REQUEST_AGE_MS) {
    await auditSecurity.suspiciousActivity(
      undefined,
      'Request signature timestamp expired or invalid',
      { headers, ip: undefined }
    );

    return {
      success: false,
      error: 'Request timestamp expired or invalid',
      details: {
        signatureValid: false,
        timestampValid: false,
        nonceValid: true,
      },
    };
  }

  // Check for nonce reuse (prevent replay attacks)
  if (usedNonces.has(nonce)) {
    await auditSecurity.suspiciousActivity(
      undefined,
      'Request nonce reused - possible replay attack',
      { headers, ip: undefined }
    );

    return {
      success: false,
      error: 'Request nonce already used',
      details: {
        signatureValid: false,
        timestampValid: true,
        nonceValid: false,
      },
    };
  }

  // Get request body
  let body = options?.body;
  if (body === undefined) {
    try {
      body = await request.text();
    } catch {
      body = '';
    }
  }

  // Compute expected signature
  const url = new URL(request.url);
  const path = url.pathname;

  try {
    const secret = getSigningSecret();
    const payload = createSignaturePayload(
      request.method,
      path,
      timestamp,
      nonce,
      body
    );

    const expectedSignature = await computeHMAC(payload, secret);

    // Constant-time comparison
    if (!secureCompare(signature, expectedSignature)) {
      await auditSecurity.suspiciousActivity(
        undefined,
        'Invalid request signature',
        { headers, ip: undefined }
      );

      return {
        success: false,
        error: 'Invalid signature',
        details: {
          signatureValid: false,
          timestampValid: true,
          nonceValid: true,
        },
      };
    }

    // Mark nonce as used
    usedNonces.set(nonce, requestTime);

    return {
      success: true,
      details: {
        signatureValid: true,
        timestampValid: true,
        nonceValid: true,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Signature verification failed',
      details: {
        signatureValid: false,
        timestampValid: true,
        nonceValid: true,
      },
    };
  }
}

/**
 * Middleware helper to verify request signature
 */
export async function requireSignedRequest(
  request: Request,
  options?: {
    body?: string;
    endpoint?: string;
  }
): Promise<{ verified: true } | { verified: false; response: Response }> {
  const result = await verifyRequest(request, options);

  if (!result.success) {
    return {
      verified: false,
      response: new Response(
        JSON.stringify({
          error: 'Unauthorized',
          message: result.error || 'Request signature verification failed',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      ),
    };
  }

  return { verified: true };
}

/**
 * Create signed fetch wrapper for internal API calls
 */
export async function signedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const urlObj = new URL(url);
  const method = options.method || 'GET';
  const body = typeof options.body === 'string' ? options.body : undefined;

  const { signature, timestamp, nonce } = await signRequest({
    method,
    path: urlObj.pathname,
    body,
  });

  const headers = new Headers(options.headers);
  headers.set(SIGNATURE_HEADER, signature);
  headers.set(TIMESTAMP_HEADER, timestamp);
  headers.set(NONCE_HEADER, nonce);

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Example usage in an internal API route:
 *
 * ```ts
 * import { requireSignedRequest } from '@/lib/requestSigning';
 *
 * export async function POST(request: Request) {
 *   // Verify request signature
 *   const signCheck = await requireSignedRequest(request);
 *
 *   if (!signCheck.verified) {
 *     return signCheck.response;
 *   }
 *
 *   // Proceed with internal API logic...
 * }
 * ```
 *
 * Example usage for making signed requests:
 *
 * ```ts
 * import { signedFetch } from '@/lib/requestSigning';
 *
 * const response = await signedFetch('https://example.com/api/internal', {
 *   method: 'POST',
 *   body: JSON.stringify({ data: 'value' }),
 *   headers: { 'Content-Type': 'application/json' },
 * });
 * ```
 */

// Export header names for external use
export const SIGNATURE_HEADERS = {
  SIGNATURE: SIGNATURE_HEADER,
  TIMESTAMP: TIMESTAMP_HEADER,
  NONCE: NONCE_HEADER,
};
