/**
 * Slack Status API Route
 *
 * Returns status of Slack OAuth connection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSlackConnection } from '@/lib/slackTokenStorage';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { connected: false, error: 'Missing userId' },
        { status: 400 }
      );
    }

    // Check for Slack OAuth connection
    const connection = await getSlackConnection(userId);

    if (!connection) {
      return NextResponse.json({
        connected: false,
        message: 'No Slack OAuth connection found',
      });
    }

    return NextResponse.json({
      connected: true,
      connectionId: connection.id,
      workspaceName: connection.provider_name || connection.provider_email,
      workspaceId: connection.provider_user_id, // This stores bot_user_id, but we can use it
      scopes: connection.scopes,
      status: connection.status,
      connectedAt: connection.created_at,
    });
  } catch (error) {
    console.error('[Slack Status API] Error:', error);
    return NextResponse.json(
      {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
