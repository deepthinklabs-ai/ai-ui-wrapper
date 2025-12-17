/**
 * @security-audit-requested
 * AUDIT FOCUS: Staging environment authentication
 * - Is the password comparison timing-safe? ✅ FIXED - using timingSafeEqual
 * - Can the static cookie value 'authenticated' be forged? ✅ FIXED - using HMAC signature
 * - Is there rate limiting to prevent brute force? ✅ FIXED - basic rate limiting added
 * - Should the cookie use a cryptographic signature/HMAC? ✅ FIXED
 * - Is the password stored securely in environment variables?
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual, createHmac, randomBytes } from 'crypto';

export const STAGING_COOKIE_NAME = 'staging_auth';

// SECURITY: In-memory rate limiting store (consider Redis for production multi-instance)
const rateLimitStore = new Map<string, { attempts: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 60000; // 1 minute

// SECURITY: Generate HMAC-signed staging token that can't be forged
export function generateStagingToken(): string {
  const secret = process.env.STAGING_PASSWORD || '';
  const timestamp = Date.now().toString();
  const nonce = randomBytes(16).toString('hex');
  const payload = `${timestamp}:${nonce}`;
  const signature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return `${payload}:${signature}`;
}

// SECURITY: Verify HMAC-signed staging token
export function verifyStagingToken(token: string): boolean {
  const secret = process.env.STAGING_PASSWORD || '';
  const parts = token.split(':');
  if (parts.length !== 3) return false;

  const [timestamp, nonce, signature] = parts;
  const payload = `${timestamp}:${nonce}`;

  // Verify token is not too old (7 days)
  const tokenAge = Date.now() - parseInt(timestamp, 10);
  if (isNaN(tokenAge) || tokenAge > 7 * 24 * 60 * 60 * 1000) {
    return false;
  }

  // SECURITY: Use timing-safe comparison for HMAC verification
  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}

// SECURITY: Check rate limit by IP
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(ip);

  if (!record || record.resetAt < now) {
    rateLimitStore.set(ip, { attempts: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (record.attempts >= MAX_ATTEMPTS) {
    return false;
  }

  record.attempts++;
  return true;
}

export async function POST(request: NextRequest) {
  const stagingPassword = process.env.STAGING_PASSWORD;

  if (!stagingPassword) {
    return NextResponse.json({ error: 'Staging not configured' }, { status: 500 });
  }

  // SECURITY: Rate limiting by IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
             request.headers.get('x-real-ip') ||
             'unknown';

  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too many attempts. Please try again later.' },
      { status: 429 }
    );
  }

  try {
    const { password } = await request.json();

    // SECURITY: Use timing-safe comparison to prevent timing attacks
    const passwordBuffer = Buffer.from(password || '');
    const stagingPasswordBuffer = Buffer.from(stagingPassword);

    // Pad to same length to prevent length-based timing leaks
    const maxLength = Math.max(passwordBuffer.length, stagingPasswordBuffer.length);
    const paddedPassword = Buffer.alloc(maxLength);
    const paddedStaging = Buffer.alloc(maxLength);
    passwordBuffer.copy(paddedPassword);
    stagingPasswordBuffer.copy(paddedStaging);

    const isValid = passwordBuffer.length === stagingPasswordBuffer.length &&
                    timingSafeEqual(paddedPassword, paddedStaging);

    if (isValid) {
      const response = NextResponse.json({ success: true });

      // SECURITY: Set HMAC-signed auth cookie (expires in 7 days)
      response.cookies.set(STAGING_COOKIE_NAME, generateStagingToken(), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7, // 7 days
        path: '/',
      });

      return response;
    }

    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
