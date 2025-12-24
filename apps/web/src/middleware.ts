/**
 * @security-audit-requested
 * AUDIT FOCUS: Middleware authentication bypass
 * - Can the staging cookie be forged (static value 'authenticated')? ✅ FIXED - HMAC verification
 * - Can path traversal bypass the checks (e.g., /staging-login/../admin)?
 * - Are API routes properly excluded or should they be protected?
 * - Can the redirect parameter be used for open redirect attacks? ✅ FIXED - validated
 * - Is the cookie secure (HttpOnly, Secure, SameSite)?
 * - CSRF protection for mutation requests? ✅ FIXED - double-submit cookie pattern
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// CSRF Configuration (duplicated from lib/csrf.ts for Edge Runtime compatibility)
const CSRF_CONFIG = {
  COOKIE_NAME: 'csrf-token',
  HEADER_NAME: 'x-csrf-token',
  TOKEN_LENGTH: 32,
  MAX_AGE_SECONDS: 24 * 60 * 60,
} as const;

const CSRF_EXEMPT_ROUTES = [
  '/api/stripe/webhook',
  '/api/oauth/',
  '/api/staging-auth',
  '/api/auth/', // Auth endpoints are called before login, need CSRF exemption
  '/api/canvas/ask-answer/', // Internal server-to-server calls from workflow trigger
  '/api/pro/', // AI provider endpoints called internally from ask-answer
] as const;

/**
 * Middleware for staging environment password protection
 *
 * Only activates when STAGING_PASSWORD env var is set.
 * Protects all routes except the staging login page and API routes.
 */

const STAGING_COOKIE_NAME = 'staging_auth';

// SECURITY: Convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

// SECURITY: Convert Uint8Array to hex string
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// SECURITY: Timing-safe comparison for Edge Runtime
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do the comparison to avoid timing leak on length
    let result = 0;
    const minLen = Math.min(a.length, b.length);
    for (let i = 0; i < minLen; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// CSRF: Generate cryptographically secure token
function generateCSRFToken(): string {
  const array = new Uint8Array(CSRF_CONFIG.TOKEN_LENGTH);
  crypto.getRandomValues(array);
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
}

// CSRF: Timing-safe string comparison
function csrfTimingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
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

// CSRF: Check if route is exempt from CSRF protection
function isCSRFExemptRoute(pathname: string): boolean {
  return CSRF_EXEMPT_ROUTES.some(route => pathname.startsWith(route));
}

// CSRF: Check if method requires protection
function requiresCSRFProtection(method: string): boolean {
  return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase());
}

// CSRF: Validate token from header against cookie
function validateCSRFToken(headerToken: string | null, cookieToken: string | null): boolean {
  if (!headerToken || !cookieToken) return false;
  if (headerToken.length !== CSRF_CONFIG.TOKEN_LENGTH * 2) return false;
  if (cookieToken.length !== CSRF_CONFIG.TOKEN_LENGTH * 2) return false;
  return csrfTimingSafeEqual(headerToken, cookieToken);
}

// SECURITY: Verify HMAC-signed staging token using Web Crypto API
// Note: Middleware can't import from route files, so we duplicate this logic
async function verifyStagingToken(token: string, secret: string): Promise<boolean> {
  const parts = token.split(':');
  if (parts.length !== 3) return false;

  const [timestamp, nonce, signature] = parts;
  const payload = `${timestamp}:${nonce}`;

  // Verify token is not too old (7 days)
  const tokenAge = Date.now() - parseInt(timestamp, 10);
  if (isNaN(tokenAge) || tokenAge > 7 * 24 * 60 * 60 * 1000) {
    return false;
  }

  try {
    // Import the secret key for HMAC
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Sign the payload
    const signatureBytes = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(payload)
    );

    const expectedSignature = bytesToHex(new Uint8Array(signatureBytes));

    // SECURITY: Use timing-safe comparison
    return timingSafeCompare(signature, expectedSignature);
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProduction = process.env.NODE_ENV === 'production';

  // Allow access to static files and Next.js internals (always)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // ============================================
  // CSRF Protection (runs in all environments)
  // ============================================

  // Check if this request requires CSRF protection
  if (requiresCSRFProtection(request.method) && pathname.startsWith('/api/')) {
    // Skip CSRF for exempt routes (webhooks, OAuth)
    if (!isCSRFExemptRoute(pathname)) {
      const headerToken = request.headers.get(CSRF_CONFIG.HEADER_NAME);
      const cookieToken = request.cookies.get(CSRF_CONFIG.COOKIE_NAME)?.value ?? null;

      if (!validateCSRFToken(headerToken, cookieToken)) {
        return NextResponse.json(
          { error: 'CSRF validation failed' },
          { status: 403 }
        );
      }
    }
  }

  // Ensure CSRF token cookie exists for all responses
  let response = NextResponse.next();
  const existingCSRFToken = request.cookies.get(CSRF_CONFIG.COOKIE_NAME)?.value;

  if (!existingCSRFToken || existingCSRFToken.length !== CSRF_CONFIG.TOKEN_LENGTH * 2) {
    const newToken = generateCSRFToken();
    response.cookies.set(CSRF_CONFIG.COOKIE_NAME, newToken, {
      httpOnly: false, // Must be readable by client JS to include in headers
      secure: isProduction,
      sameSite: 'strict',
      maxAge: CSRF_CONFIG.MAX_AGE_SECONDS,
      path: '/',
    });
  }

  // ============================================
  // Staging Protection (only when STAGING_PASSWORD is set)
  // ============================================

  const stagingPassword = process.env.STAGING_PASSWORD;

  // If no staging password is set, skip staging protection
  if (!stagingPassword) {
    return response;
  }

  // Allow access to staging login page and its API
  if (pathname === '/staging-login' || pathname === '/api/staging-auth') {
    return response;
  }

  // SECURITY: Verify HMAC-signed staging auth cookie
  const stagingCookie = request.cookies.get(STAGING_COOKIE_NAME);

  if (stagingCookie?.value && await verifyStagingToken(stagingCookie.value, stagingPassword)) {
    return response;
  }

  // SECURITY: Validate redirect parameter to prevent open redirect attacks
  const loginUrl = new URL('/staging-login', request.url);
  // Only allow relative paths that start with / but not //
  if (pathname.startsWith('/') && !pathname.startsWith('//')) {
    loginUrl.searchParams.set('redirect', pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
