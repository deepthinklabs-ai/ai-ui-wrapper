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

// Helper to get app URL for redirects after OAuth callback
// In development, always use localhost:3000 to avoid stale tunnel URLs
const getAppUrl = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }
  return 'http://localhost:3000';
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('[OAuth Callback] Google returned error:', error);
      return NextResponse.redirect(
        `${getAppUrl()}/canvas?oauth_error=${encodeURIComponent(error)}`
      );
    }

    if (!code || !state) {
      console.error('[OAuth Callback] Missing code or state');
      return NextResponse.redirect(
        `${getAppUrl()}/canvas?oauth_error=missing_parameters`
      );
    }

    // Verify state parameter (CSRF protection)
    console.log('[OAuth Callback] Verifying state:', state);
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .single();

    if (stateError || !stateData) {
      console.error('[OAuth Callback] State verification failed:', stateError?.message || 'State not found');
      return NextResponse.redirect(
        `${getAppUrl()}/canvas?oauth_error=invalid_state`
      );
    }

    // Check if state has expired (10 minutes)
    const expiresAt = new Date(stateData.expires_at);
    if (expiresAt < new Date()) {
      console.error('[OAuth Callback] State expired');
      await supabase.from('oauth_states').delete().eq('state', state);
      return NextResponse.redirect(
        `${getAppUrl()}/canvas?oauth_error=expired_state`
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

    // Redirect back to canvas page with success
    console.log('[OAuth Callback] Success! Redirecting to canvas');
    return NextResponse.redirect(
      `${getAppUrl()}/canvas?oauth_success=true`
    );
  } catch (error: any) {
    console.error('[OAuth Callback] Error:', error);
    return NextResponse.redirect(
      `${getAppUrl()}/canvas?oauth_error=${encodeURIComponent(
        error.message || 'oauth_failed'
      )}`
    );
  }
}
