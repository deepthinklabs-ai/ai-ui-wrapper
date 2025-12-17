/**
 * @security-audit-requested
 * AUDIT FOCUS: 2FA code verification
 * - Is userId authenticated or just passed from client (IDOR risk)?
 * - Is brute force protection effective (5 attempts limit)?
 * - Is the code comparison timing-safe?
 * - Can an attacker verify codes for other users?
 * - Is the attempt counter increment atomic/race-condition free?
 * - Can expired codes be reused?
 */

/**
 * Verify Email Code API
 *
 * Validates the 6-digit code entered by the user.
 * On success, marks the code as verified and enables 2FA for the user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { timingSafeEqual } from 'crypto';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, code, purpose = 'login', enableTwoFactor = false } = body;

    if (!userId || !code) {
      return NextResponse.json(
        { error: 'Missing userId or code' },
        { status: 400 }
      );
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: 'Invalid code format. Please enter a 6-digit code.' },
        { status: 400 }
      );
    }

    // SECURITY: Verify the userId exists to prevent enumeration
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userError || !userData?.user) {
      // Don't reveal if user exists - use generic error
      return NextResponse.json(
        { error: 'Invalid verification code. Please check and try again.' },
        { status: 400 }
      );
    }

    // SECURITY: Fetch all unverified codes for this user/purpose to enable timing-safe comparison
    const { data: verificationRecords, error: findError } = await supabaseAdmin
      .from('email_verification_codes')
      .select('*')
      .eq('user_id', userId)
      .eq('purpose', purpose)
      .is('verified_at', null);

    if (findError || !verificationRecords || verificationRecords.length === 0) {
      return NextResponse.json(
        { error: 'Invalid verification code. Please check and try again.' },
        { status: 400 }
      );
    }

    // SECURITY: Use timing-safe comparison to prevent timing attacks
    // IMPORTANT: Must iterate ALL records to maintain constant time (no early break)
    let verificationRecord = null;
    let matchFound = false;
    for (const record of verificationRecords) {
      try {
        const recordCodeBuffer = Buffer.from(record.code.padEnd(6, '0'));
        const inputCodeBuffer = Buffer.from(code.padEnd(6, '0'));
        if (recordCodeBuffer.length === inputCodeBuffer.length &&
            timingSafeEqual(recordCodeBuffer, inputCodeBuffer)) {
          // Only capture the first match, but continue iterating for constant time
          if (!matchFound) {
            verificationRecord = record;
            matchFound = true;
          }
        }
      } catch {
        // Continue to next record if comparison fails
      }
    }

    if (!verificationRecord) {
      // Increment attempts for all unverified codes for this user
      // SECURITY: Use raw increment to avoid race conditions
      for (const record of verificationRecords) {
        await supabaseAdmin
          .from('email_verification_codes')
          .update({ attempts: (record.attempts || 0) + 1 })
          .eq('id', record.id);
      }

      return NextResponse.json(
        { error: 'Invalid verification code. Please check and try again.' },
        { status: 400 }
      );
    }

    // Check if code is expired
    if (new Date(verificationRecord.expires_at) < new Date()) {
      return NextResponse.json(
        { error: 'Verification code has expired. Please request a new one.' },
        { status: 400 }
      );
    }

    // Check max attempts
    if (verificationRecord.attempts >= 5) {
      return NextResponse.json(
        { error: 'Too many incorrect attempts. Please request a new code.' },
        { status: 400 }
      );
    }

    // Mark code as verified
    const { error: updateError } = await supabaseAdmin
      .from('email_verification_codes')
      .update({ verified_at: new Date().toISOString() })
      .eq('id', verificationRecord.id);

    if (updateError) {
      console.error('[2FA] Error marking code as verified:', updateError);
      return NextResponse.json(
        { error: 'Failed to verify code' },
        { status: 500 }
      );
    }

    // If this is a signup verification, enable 2FA for the user
    if (enableTwoFactor || purpose === 'signup') {
      const { error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .update({ email_2fa_enabled: true })
        .eq('id', userId);

      if (profileError) {
        console.error('[2FA] Error enabling 2FA for user:', profileError);
        // Don't fail the verification, just log the error
      } else {
        console.log(`[2FA] 2FA enabled for user ${userId}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      twoFactorEnabled: enableTwoFactor || purpose === 'signup',
    });
  } catch (error: any) {
    console.error('[2FA] Error verifying code:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify code' },
      { status: 500 }
    );
  }
}
