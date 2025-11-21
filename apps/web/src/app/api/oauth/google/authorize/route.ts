/**
 * Google OAuth Authorization Endpoint
 * Initiates the OAuth flow by redirecting to Google's authorization page
 */

import { NextRequest, NextResponse } from 'next/server';
import { getGoogleAuthUrl } from '@/lib/googleOAuth';
import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Get user ID from query params or session
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

    // Generate Google OAuth URL
    const authUrl = getGoogleAuthUrl(state);

    // Redirect to Google's authorization page
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error('OAuth authorization error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initiate OAuth flow' },
      { status: 500 }
    );
  }
}
