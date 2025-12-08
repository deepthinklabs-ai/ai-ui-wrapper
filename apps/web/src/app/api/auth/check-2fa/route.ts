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

    // Find user by email using the admin API
    const { data: users, error: userError } = await supabaseAdmin.auth.admin.listUsers();

    if (userError) {
      console.error('[2FA] Error listing users:', userError);
      return NextResponse.json(
        { error: 'Failed to check user status' },
        { status: 500 }
      );
    }

    const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());

    if (!user) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({
        requires2FA: false,
        userExists: false,
      });
    }

    // Check if user has 2FA enabled in their profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('email_2fa_enabled')
      .eq('id', user.id)
      .single();

    if (profileError) {
      // User might not have a profile yet (new user)
      return NextResponse.json({
        requires2FA: false,
        userId: user.id,
      });
    }

    return NextResponse.json({
      requires2FA: profile?.email_2fa_enabled ?? false,
      userId: user.id,
    });
  } catch (error: any) {
    console.error('[2FA] Error checking 2FA status:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check 2FA status' },
      { status: 500 }
    );
  }
}
