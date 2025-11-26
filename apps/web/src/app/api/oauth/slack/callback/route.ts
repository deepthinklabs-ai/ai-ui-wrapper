/**
 * Slack OAuth Callback Endpoint
 * Handles the redirect from Slack after user authorization
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { storeSlackTokens, type SlackOAuthResponse } from '@/lib/slackTokenStorage';

// Server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID!;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET!;

// Helper to get app URL (prefer server-side APP_URL to avoid Next.js auto-override)
const getAppUrl = () => process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    const appUrl = getAppUrl();

    // Handle OAuth errors
    if (error) {
      console.error('[Slack OAuth Callback] Slack returned error:', error);
      return NextResponse.redirect(
        `${appUrl}/canvas?oauth_error=${encodeURIComponent(error)}&provider=slack`
      );
    }

    if (!code || !state) {
      console.error('[Slack OAuth Callback] Missing code or state');
      return NextResponse.redirect(
        `${appUrl}/canvas?oauth_error=missing_parameters&provider=slack`
      );
    }

    // Verify state parameter (CSRF protection)
    console.log('[Slack OAuth Callback] Verifying state:', state);
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .single();

    if (stateError || !stateData) {
      console.error('[Slack OAuth Callback] State verification failed:', stateError?.message || 'State not found');
      return NextResponse.redirect(
        `${appUrl}/canvas?oauth_error=invalid_state&provider=slack`
      );
    }

    // Check if state has expired (10 minutes)
    const expiresAt = new Date(stateData.expires_at);
    if (expiresAt < new Date()) {
      console.error('[Slack OAuth Callback] State expired');
      await supabase.from('oauth_states').delete().eq('state', state);
      return NextResponse.redirect(
        `${appUrl}/canvas?oauth_error=expired_state&provider=slack`
      );
    }

    const userId = stateData.user_id;

    // Delete used state
    await supabase.from('oauth_states').delete().eq('state', state);

    // Exchange authorization code for tokens
    const redirectUri = `${appUrl}/api/oauth/slack/callback`;
    const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: SLACK_CLIENT_ID,
        client_secret: SLACK_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    });

    const tokenData: SlackOAuthResponse = await tokenResponse.json();

    if (!tokenData.ok) {
      console.error('[Slack OAuth Callback] Token exchange failed:', tokenData.error);
      return NextResponse.redirect(
        `${appUrl}/canvas?oauth_error=${encodeURIComponent(
          tokenData.error || 'token_exchange_failed'
        )}&provider=slack`
      );
    }

    console.log('[Slack OAuth Callback] Token exchange successful for workspace:', tokenData.team.name);

    // Store tokens securely in database
    await storeSlackTokens(userId, tokenData);

    // Redirect back to canvas page with success
    console.log('[Slack OAuth Callback] Success! Redirecting to canvas');
    return NextResponse.redirect(
      `${appUrl}/canvas?oauth_success=true&provider=slack`
    );
  } catch (error: any) {
    console.error('[Slack OAuth Callback] Error:', error);
    const appUrl = getAppUrl();
    return NextResponse.redirect(
      `${appUrl}/canvas?oauth_error=${encodeURIComponent(
        error.message || 'oauth_failed'
      )}&provider=slack`
    );
  }
}
