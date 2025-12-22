/**
 * Debug endpoint to check environment variables (temporary)
 * Remove after debugging OAuth issues
 */

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    GOOGLE_OAUTH_CLIENT_ID_present: !!process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_ID_length: process.env.GOOGLE_OAUTH_CLIENT_ID?.length || 0,
    GOOGLE_OAUTH_CLIENT_SECRET_present: !!process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    APP_URL: process.env.APP_URL || 'not set',
    NODE_ENV: process.env.NODE_ENV,
  });
}
