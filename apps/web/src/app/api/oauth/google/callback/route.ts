/**
 * @security-audit-requested
 * AUDIT FOCUS: Google OAuth callback security
 * - Is CSRF protection (state parameter) properly implemented?
 * - Is the state token cryptographically random?
 * - Can an attacker steal tokens via open redirect in error handling?
 * - Are tokens stored securely after exchange?
 * - Is the state deletion atomic (race condition risk)?
 * - Can error messages leak sensitive information?
 */

/**
 * Google OAuth Callback Endpoint
 * Handles the redirect from Google after user authorization
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { exchangeCodeForTokens, getGoogleUserInfo } from '@/lib/googleOAuth';
import { storeOAuthTokens } from '@/lib/googleTokenStorage';
import { withDebug } from '@/lib/debug';

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

export const GET = withDebug(async (request, sessionId) => {
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

    // SECURITY: Atomically claim and delete state to prevent TOCTOU race conditions
    // This ensures each state can only be consumed once
    console.log('[OAuth Callback] Verifying and claiming state:', state);
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_states')
      .delete()
      .eq('state', state)
      .select('*')
      .single();

    if (stateError || !stateData) {
      console.error('[OAuth Callback] State verification failed:', stateError?.message || 'State not found or already used');
      return NextResponse.redirect(
        `${getAppUrl()}/canvas?oauth_error=invalid_state`
      );
    }

    // Check if state has expired (10 minutes)
    const expiresAt = new Date(stateData.expires_at);
    if (expiresAt < new Date()) {
      console.error('[OAuth Callback] State expired');
      // State already deleted above, no need to delete again
      return NextResponse.redirect(
        `${getAppUrl()}/canvas?oauth_error=expired_state`
      );
    }

    const userId = stateData.user_id;

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
});
