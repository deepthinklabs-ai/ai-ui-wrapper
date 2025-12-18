/**
 * CSRF Protection Utilities
 *
 * Implements double-submit cookie pattern for CSRF protection.
 * - Token stored in HttpOnly cookie
 * - Client must send token in X-CSRF-Token header
 * - Server validates header matches cookie
 */

// CSRF configuration
export const CSRF_CONFIG = {
  COOKIE_NAME: 'csrf-token',
  HEADER_NAME: 'x-csrf-token',
  TOKEN_LENGTH: 32, // 32 bytes = 64 hex chars
  MAX_AGE_SECONDS: 24 * 60 * 60, // 24 hours
} as const;

// Routes exempt from CSRF protection
export const CSRF_EXEMPT_ROUTES = [
  // Webhooks have their own signature verification
  '/api/stripe/webhook',
  // OAuth routes use state tokens
  '/api/oauth/',
  // Staging auth is protected differently
  '/api/staging-auth',
  // GET requests are exempt (handled in middleware)
] as const;

/**
 * Generate a cryptographically secure CSRF token
 */
export function generateCSRFToken(): string {
  const array = new Uint8Array(CSRF_CONFIG.TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Timing-safe string comparison to prevent timing attacks
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still iterate to avoid timing leak on length difference
    let result = 0;
    const maxLen = Math.max(a.length, b.length);
    for (let i = 0; i < maxLen; i++) {
      const charA = i < a.length ? a.charCodeAt(i) : 0;
      const charB = i < b.length ? b.charCodeAt(i) : 0;
      result |= charA ^ charB;
    }
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Validate CSRF token from header against cookie
 */
export function validateCSRFToken(
  headerToken: string | null | undefined,
  cookieToken: string | null | undefined
): boolean {
  // Both tokens must be present
  if (!headerToken || !cookieToken) {
    return false;
  }

  // Tokens must have correct length (64 hex chars)
  if (headerToken.length !== CSRF_CONFIG.TOKEN_LENGTH * 2) {
    return false;
  }

  if (cookieToken.length !== CSRF_CONFIG.TOKEN_LENGTH * 2) {
    return false;
  }

  // Use timing-safe comparison
  return timingSafeEqual(headerToken, cookieToken);
}

/**
 * Check if a route is exempt from CSRF protection
 */
export function isCSRFExemptRoute(pathname: string): boolean {
  return CSRF_EXEMPT_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * Check if a request method requires CSRF protection
 * Only mutations (POST, PUT, DELETE, PATCH) need protection
 */
export function requiresCSRFProtection(method: string): boolean {
  const mutationMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  return mutationMethods.includes(method.toUpperCase());
}
