/**
 * Google OAuth Revoke Endpoint
 * Revokes Google OAuth access and deletes stored tokens
 */

import { NextRequest, NextResponse } from 'next/server';
import { revokeGoogleToken } from '@/lib/googleOAuth';
import { getOAuthConnection, deleteOAuthConnection, decryptToken } from '@/lib/googleTokenStorage';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get the connection to retrieve access token
    const connection = await getOAuthConnection(userId, 'google');

    if (connection) {
      try {
        // Revoke the token with Google
        const accessToken = decryptToken(connection.access_token_encrypted);
        await revokeGoogleToken(accessToken);
      } catch (error) {
        console.error('Error revoking token with Google:', error);
        // Continue even if Google revocation fails
      }
    }

    // Delete the connection from database
    await deleteOAuthConnection(userId, 'google');

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('OAuth revoke error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to revoke OAuth access' },
      { status: 500 }
    );
  }
}
