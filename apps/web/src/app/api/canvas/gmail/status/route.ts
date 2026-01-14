/**
 * Gmail OAuth Status API Route
 *
 * Returns the current Gmail OAuth connection status for a user.
 * Used by Genesis Bot nodes to check if Gmail is connected.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withDebug } from '@/lib/debug';

export const GET = withDebug(async (request, sessionId) => {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId parameter' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch OAuth connection for Google (which includes Gmail)
    const { data: connection, error } = await supabase
      .from('oauth_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('provider', 'google')
      .single();

    if (error || !connection) {
      return NextResponse.json({
        connected: false,
        status: 'disconnected',
      });
    }

    // Use the database status field directly
    // Note: access tokens expire hourly but are auto-refreshed via refresh_token
    // The status is only set to 'expired' when the refresh actually fails
    // So we should NOT check token_expires_at here - it's a false positive
    const status = connection.status === 'active'
      ? 'connected'
      : connection.status === 'expired'
        ? 'expired'
        : 'disconnected';

    // Check if Gmail scopes are present
    // SECURITY: Use exact patterns for Google OAuth scope validation
    const GMAIL_SCOPE_PATTERNS = [
      'https://www.googleapis.com/auth/gmail',     // Gmail API scopes prefix
      'https://mail.google.com/',                   // Full Gmail access
    ];
    const scopes = connection.scopes || [];

    // If scopes array is empty/null, assume legacy connection with all scopes granted
    // (Settings OAuth flow requests all scopes when no service parameter is provided)
    const hasGmailScopes = scopes.length === 0 || scopes.some((scope: string) =>
      GMAIL_SCOPE_PATTERNS.some(pattern => scope.startsWith(pattern))
    );

    if (!hasGmailScopes) {
      return NextResponse.json({
        connected: false,
        status: 'disconnected',
        reason: 'Gmail scopes not granted',
      });
    }

    return NextResponse.json({
      connected: status === 'connected',
      connectionId: connection.id,
      email: connection.provider_email,
      name: connection.provider_name,
      picture: connection.provider_picture,
      status,
      connectedAt: connection.created_at,
      lastUsedAt: connection.last_used_at,
      scopes: connection.scopes,
    });
  } catch (error) {
    console.error('[Gmail Status API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
