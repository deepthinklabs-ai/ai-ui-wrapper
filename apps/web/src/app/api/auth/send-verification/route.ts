/**
 * @security-audit-requested
 * AUDIT FOCUS: 2FA code generation and delivery
 * - Is the verification code cryptographically random (not Math.random)?
 * - Can the rate limiting be bypassed?
 * - Is userId authenticated or just passed from client (IDOR risk)?
 * - Can an attacker enumerate valid emails?
 * - Is the code leaked in logs or responses?
 * - Is the email content safe from injection?
 */

/**
 * Send Email Verification Code API
 *
 * Generates a 6-digit code and sends it to the user's email.
 * Uses Resend for email delivery.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { randomInt } from 'crypto';
import { auditAuth, auditSecurity } from '@/lib/auditLog';

// Initialize Supabase admin client
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// SECURITY: Generate a cryptographically secure 6-digit verification code
function generateVerificationCode(): string {
  return randomInt(100000, 1000000).toString();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, email, purpose = 'login' } = body;

    if (!userId || !email) {
      return NextResponse.json(
        { error: 'Missing userId or email' },
        { status: 400 }
      );
    }

    // SECURITY: Verify the userId exists and the email matches
    // This prevents IDOR attacks where an attacker could spam arbitrary emails
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);

    if (userError || !userData?.user) {
      // Don't reveal if user exists - use generic error
      return NextResponse.json(
        { error: 'Unable to send verification code' },
        { status: 400 }
      );
    }

    // Verify the email matches the user's actual email
    if (userData.user.email?.toLowerCase() !== email.toLowerCase()) {
      // Don't reveal the mismatch - use generic error
      return NextResponse.json(
        { error: 'Unable to send verification code' },
        { status: 400 }
      );
    }

    // Rate limit: Check if user has requested too many codes recently
    const { data: recentCodes, error: recentError } = await supabaseAdmin
      .from('email_verification_codes')
      .select('id, created_at')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 60000).toISOString()) // Last 60 seconds
      .order('created_at', { ascending: false });

    if (recentError) {
      console.error('[2FA] Error checking recent codes:', recentError);
    }

    if (recentCodes && recentCodes.length >= 3) {
      // Audit: Rate limit exceeded
      await auditSecurity.rateLimitExceeded(userId, '/api/auth/send-verification', {
        headers: req.headers,
      });
      return NextResponse.json(
        { error: 'Too many verification requests. Please wait a minute before trying again.' },
        { status: 429 }
      );
    }

    // Generate new code
    const code = generateVerificationCode();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Delete any existing unexpired codes for this user/purpose
    await supabaseAdmin
      .from('email_verification_codes')
      .delete()
      .eq('user_id', userId)
      .eq('purpose', purpose)
      .is('verified_at', null);

    // Insert new verification code
    const { error: insertError } = await supabaseAdmin
      .from('email_verification_codes')
      .insert({
        user_id: userId,
        email,
        code,
        purpose,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('[2FA] Error inserting verification code:', insertError);
      return NextResponse.json(
        { error: 'Failed to create verification code' },
        { status: 500 }
      );
    }

    // Send email using Resend
    const purposeText = purpose === 'signup' ? 'verify your email' : 'sign in';

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'noreply@resend.dev',
      to: email,
      subject: `Your verification code: ${code}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a; color: #e2e8f0; padding: 40px 20px; margin: 0;">
          <div style="max-width: 480px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; padding: 40px; border: 1px solid #334155;">
            <h1 style="color: #f1f5f9; font-size: 24px; font-weight: 600; margin: 0 0 16px 0; text-align: center;">
              Verification Code
            </h1>
            <p style="color: #94a3b8; font-size: 16px; line-height: 1.5; margin: 0 0 32px 0; text-align: center;">
              Use this code to ${purposeText}:
            </p>
            <div style="background-color: #0f172a; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 32px;">
              <span style="font-family: 'SF Mono', Monaco, 'Courier New', monospace; font-size: 36px; font-weight: 700; color: #60a5fa; letter-spacing: 8px;">
                ${code}
              </span>
            </div>
            <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin: 0; text-align: center;">
              This code expires in 10 minutes.<br>
              If you didn't request this code, you can safely ignore this email.
            </p>
          </div>
        </body>
        </html>
      `,
    });

    if (emailError) {
      console.error('[2FA] Error sending email via Resend:', emailError);
      // Don't fail completely - code is saved, user can click resend
      // But log the error for debugging
    } else {
      console.log(`[2FA] Email sent to ${email}, messageId: ${emailData?.id}`);
    }

    // SECURITY: Never log verification codes in production
    if (process.env.NODE_ENV === 'development') {
      console.log(`[2FA] Verification code for ${email}: ${code}`);
    }

    // Audit: 2FA code sent successfully
    await auditAuth.twoFactorSent(userId, email, { headers: req.headers });

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your email',
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error: any) {
    console.error('[2FA] Error sending verification code:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to send verification code' },
      { status: 500 }
    );
  }
}
