/**
 * Slack OAuth Authorization Endpoint
 * Initiates the OAuth flow by redirecting to Slack's authorization page
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Slack OAuth configuration
const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;

// Bot scopes for full access
const SLACK_BOT_SCOPES = [
  'channels:read',
  'channels:history',
  'channels:join',
  'channels:manage',
  'chat:write',
  'reactions:read',
  'reactions:write',
  'users:read',
  'users:read.email',
  'files:read',
  'files:write',
  'groups:read',
  'groups:history',
  'im:read',
  'im:history',
  'mpim:read',
  'mpim:history',
].join(',');

export async function GET(request: NextRequest) {
  try {
    if (!SLACK_CLIENT_ID) {
      return NextResponse.json(
        { error: 'Slack OAuth is not configured' },
        { status: 500 }
      );
    }

    // Get user ID from query params
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Generate a random state parameter for CSRF protection
    const state = crypto.randomUUID();

    // Store state in database for verification in callback
    await supabase
      .from('oauth_states')
      .insert({
        state,
        user_id: userId,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      });

    // Use APP_URL (server-side only var) to avoid Next.js auto-override of NEXT_PUBLIC_APP_URL
    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL;
    const SLACK_REDIRECT_URI = `${appUrl}/api/oauth/slack/callback`;

    console.log('[Slack OAuth] DEBUG - APP_URL:', process.env.APP_URL);
    console.log('[Slack OAuth] DEBUG - NEXT_PUBLIC_APP_URL:', process.env.NEXT_PUBLIC_APP_URL);
    console.log('[Slack OAuth] DEBUG - SLACK_REDIRECT_URI:', SLACK_REDIRECT_URI);
    console.log('[Slack OAuth] Redirecting to Slack authorization');

    // Build Slack OAuth URL
    const slackAuthUrl = new URL('https://slack.com/oauth/v2/authorize');
    slackAuthUrl.searchParams.set('client_id', SLACK_CLIENT_ID);
    slackAuthUrl.searchParams.set('scope', SLACK_BOT_SCOPES);
    slackAuthUrl.searchParams.set('redirect_uri', SLACK_REDIRECT_URI);
    slackAuthUrl.searchParams.set('state', state);

    // Redirect to Slack's authorization page
    return NextResponse.redirect(slackAuthUrl.toString());
  } catch (error: any) {
    console.error('[Slack OAuth] Authorization error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}
