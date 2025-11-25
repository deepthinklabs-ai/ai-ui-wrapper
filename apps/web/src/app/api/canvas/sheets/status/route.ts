/**
 * Google Sheets Status API Route
 *
 * Checks if a user has a valid Sheets connection.
 * Uses the same OAuth connection as Gmail (Google OAuth).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getOAuthConnection } from '@/lib/googleTokenStorage';

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

    // Check for Google OAuth connection
    const connection = await getOAuthConnection(userId, 'google');

    if (!connection) {
      return NextResponse.json({
        isConnected: false,
        message: 'No Google connection found',
      });
    }

    // Check if Sheets scope is included
    const hasSheetScope = connection.scopes?.some((s: string) =>
      s.includes('spreadsheets')
    );

    if (!hasSheetScope) {
      return NextResponse.json({
        isConnected: false,
        message: 'Sheets scope not granted. Please reconnect with Sheets permissions.',
      });
    }

    return NextResponse.json({
      isConnected: true,
      email: connection.provider_email,
      connectionId: connection.id,
      scopes: connection.scopes,
      lastUsed: connection.last_used_at,
    });
  } catch (error) {
    console.error('[Sheets Status] Error:', error);
    return NextResponse.json(
      { error: 'Failed to check Sheets status' },
      { status: 500 }
    );
  }
}
