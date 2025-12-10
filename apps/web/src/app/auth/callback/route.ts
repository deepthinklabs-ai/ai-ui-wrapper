/**
 * Supabase Auth Callback Route
 *
 * Handles authentication callbacks from Supabase, including:
 * - Password recovery (reset password flow)
 * - Email confirmation
 * - OAuth callbacks
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');
  const next = requestUrl.searchParams.get('next') || '/dashboard';

  // Get the origin for redirects
  const origin = requestUrl.origin;

  if (token_hash && type) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Exchange the token for a session
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'recovery' | 'signup' | 'invite' | 'magiclink' | 'email_change',
    });

    if (error) {
      console.error('Auth callback error:', error.message);
      // Redirect to auth page with error
      return NextResponse.redirect(
        `${origin}/auth?error=${encodeURIComponent(error.message)}`
      );
    }

    // Handle different callback types
    if (type === 'recovery') {
      // Password recovery - redirect to reset password page
      return NextResponse.redirect(`${origin}/auth/reset-password`);
    }

    // For other types (signup confirmation, etc.), redirect to next page
    return NextResponse.redirect(`${origin}${next}`);
  }

  // No token provided, redirect to auth page
  return NextResponse.redirect(`${origin}/auth`);
}
