/**
 * Google Docs Status API Route
 *
 * Returns status of Docs OAuth connection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOAuthConnection } from '@/lib/googleTokenStorage';

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

    // Check for Google OAuth connection (shared with Gmail/Sheets)
    const connection = await getOAuthConnection(userId, 'google');

    if (!connection) {
      return NextResponse.json({
        connected: false,
        message: 'No Google OAuth connection found',
      });
    }

    // Check if scopes include docs
    const scopes = connection.scopes || [];

    // If scopes array is empty/null, assume legacy connection with all scopes granted
    // (Settings OAuth flow requests all scopes when no service parameter is provided)
    const hasDocsScope = scopes.length === 0 || scopes.some((s: string) => s.includes('documents'));

    return NextResponse.json({
      connected: true,
      connectionId: connection.id,
      hasDocsScope,
      email: connection.provider_email,
      createdAt: connection.created_at,
    });
  } catch (error) {
    console.error('[Docs Status API] Error:', error);
    return NextResponse.json(
      {
        connected: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
