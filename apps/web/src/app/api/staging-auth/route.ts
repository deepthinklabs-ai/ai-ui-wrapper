/**
 * @security-audit-requested
 * AUDIT FOCUS: Staging environment authentication
 * - Is the password comparison timing-safe?
 * - Can the static cookie value 'authenticated' be forged?
 * - Is there rate limiting to prevent brute force?
 * - Should the cookie use a cryptographic signature/HMAC?
 * - Is the password stored securely in environment variables?
 */

import { NextRequest, NextResponse } from 'next/server';

const STAGING_COOKIE_NAME = 'staging_auth';
const STAGING_COOKIE_VALUE = 'authenticated';

export async function POST(request: NextRequest) {
  const stagingPassword = process.env.STAGING_PASSWORD;

  if (!stagingPassword) {
    return NextResponse.json({ error: 'Staging not configured' }, { status: 500 });
  }

  try {
    const { password } = await request.json();

    if (password === stagingPassword) {
      const response = NextResponse.json({ success: true });

      // Set auth cookie (expires in 7 days)
      response.cookies.set(STAGING_COOKIE_NAME, STAGING_COOKIE_VALUE, {
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
