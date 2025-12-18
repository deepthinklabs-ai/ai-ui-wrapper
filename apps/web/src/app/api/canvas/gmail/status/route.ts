/**
 * Gmail OAuth Status API Route
 *
 * Returns the current Gmail OAuth connection status for a user.
 * Used by Genesis Bot nodes to check if Gmail is connected.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
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

    // Check if token is expired
    const tokenExpired = connection.token_expires_at
      ? new Date(connection.token_expires_at) < new Date()
      : false;

    const status = connection.status === 'revoked'
      ? 'disconnected'
      : tokenExpired
        ? 'expired'
        : 'connected';

    // Check if Gmail scopes are present
    // SECURITY: Use exact patterns for Google OAuth scope validation
    const GMAIL_SCOPE_PATTERNS = [
      'https://www.googleapis.com/auth/gmail',     // Gmail API scopes prefix
      'https://mail.google.com/',                   // Full Gmail access
    ];
    const scopes = connection.scopes || [];
    const hasGmailScopes = scopes.some((scope: string) =>
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
}
