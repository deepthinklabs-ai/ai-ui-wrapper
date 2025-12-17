/**
 * @security-audit-requested
 * AUDIT FOCUS: Middleware authentication bypass
 * - Can the staging cookie be forged (static value 'authenticated')? ✅ FIXED - HMAC verification
 * - Can path traversal bypass the checks (e.g., /staging-login/../admin)?
 * - Are API routes properly excluded or should they be protected?
 * - Can the redirect parameter be used for open redirect attacks? ✅ FIXED - validated
 * - Is the cookie secure (HttpOnly, Secure, SameSite)?
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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
  const stagingPassword = process.env.STAGING_PASSWORD;

  // If no staging password is set, skip protection (production)
  if (!stagingPassword) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Allow access to staging login page and its API
  if (pathname === '/staging-login' || pathname === '/api/staging-auth') {
    return NextResponse.next();
  }

  // Allow access to static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // SECURITY: Verify HMAC-signed staging auth cookie
  const stagingCookie = request.cookies.get(STAGING_COOKIE_NAME);

  if (stagingCookie?.value && await verifyStagingToken(stagingCookie.value, stagingPassword)) {
    return NextResponse.next();
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
