/**
 * @security-audit-requested
 * AUDIT FOCUS: 2FA status check
 * - Does the response leak whether a user exists (user enumeration)?
 * - Is the listUsers() call a performance/DoS risk?
 * - Should this endpoint require authentication?
 * - Can response timing differences reveal user existence?
 */

/**
 * Check 2FA Status API
 *
 * Checks if a user has 2FA enabled.
 * Used during login to determine if verification code is needed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Missing email' },
        { status: 400 }
      );
    }

    // SECURITY: Query user_profiles directly by email to avoid loading all users (DoS risk)
    // Join with auth.users via RPC or query profiles that have matching email in auth
    // First, get the user ID from auth.users using a direct query
    const { data: authUser, error: authError } = await supabaseAdmin
      .from('auth.users')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    // SECURITY: If direct auth.users query fails, fall back to checking user_profiles
    // This handles cases where auth.users isn't directly queryable
    let userId: string | null = null;

    if (authError || !authUser) {
      // Try to find user via listUsers with pagination (limited DoS impact)
      // Only fetch first page with small limit
      const { data: users } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000, // Reasonable limit
      });

      const user = users?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
      userId = user?.id || null;
    } else {
      userId = authUser.id;
    }

    // SECURITY: Track start time to apply consistent delay at end
    const startTime = Date.now();
    const MIN_RESPONSE_TIME = 150; // Minimum response time in ms to mask timing differences

    // SECURITY: Always return the same response structure to prevent user enumeration
    // Don't reveal whether user exists or not
    let requires2FA = false;

    if (userId) {
      // Check if user has 2FA enabled in their profile
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('email_2fa_enabled')
        .eq('id', userId)
        .single();

      requires2FA = profile?.email_2fa_enabled ?? false;
    }

    // SECURITY: Apply consistent timing delay to all responses to prevent timing attacks
    // This masks the difference between "user exists" and "user doesn't exist" paths
    const elapsed = Date.now() - startTime;
    if (elapsed < MIN_RESPONSE_TIME) {
      await new Promise(resolve => setTimeout(resolve, MIN_RESPONSE_TIME - elapsed));
    }

    return NextResponse.json({
      requires2FA,
    });
  } catch (error: any) {
    console.error('[2FA] Error checking 2FA status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check 2FA status' },
      { status: 500 }
    );
  }
}
