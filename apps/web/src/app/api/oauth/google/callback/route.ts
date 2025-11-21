/**
 * Google OAuth Callback Endpoint
 * Handles the redirect from Google after user authorization
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exchangeCodeForTokens, getGoogleUserInfo } from '@/lib/googleOAuth';
import { storeOAuthTokens } from '@/lib/googleTokenStorage';

// Server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/tools?error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/tools?error=missing_parameters`
      );
    }

    // Verify state parameter (CSRF protection)
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .single();

    if (stateError || !stateData) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/tools?error=invalid_state`
      );
    }

    // Check if state has expired (10 minutes)
    const expiresAt = new Date(stateData.expires_at);
    if (expiresAt < new Date()) {
      await supabase.from('oauth_states').delete().eq('state', state);
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/tools?error=expired_state`
      );
    }

    const userId = stateData.user_id;

    // Delete used state
    await supabase.from('oauth_states').delete().eq('state', state);

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get user info from Google
    const userInfo = await getGoogleUserInfo(tokens.access_token);

    // Store tokens securely in database
    await storeOAuthTokens(userId, 'google', tokens, userInfo);

    // Redirect back to tools page with success
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/tools?success=true`
    );
  } catch (error: any) {
    console.error('OAuth callback error:', error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/tools?error=${encodeURIComponent(
        error.message || 'oauth_failed'
      )}`
    );
  }
}
