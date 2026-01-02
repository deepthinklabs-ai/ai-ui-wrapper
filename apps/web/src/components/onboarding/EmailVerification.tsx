/**
 * Email Verification Component
 *
 * Handles email 2FA during onboarding:
 * 1. Sends verification code to user's email
 * 2. User enters 6-digit code
 * 3. Verifies code and enables 2FA
 */

"use client";

import React, { useState, useEffect, useRef } from 'react';

type EmailVerificationProps = {
  userId: string;
  userEmail: string;
  onComplete: () => void;
  onBack?: () => void;
};

export default function EmailVerification({
  userId,
  userEmail,
  onComplete,
  onBack,
}: EmailVerificationProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const hasSentInitialCode = useRef(false);

  // Send verification code on mount (only once, even in React Strict Mode)
  useEffect(() => {
    if (!hasSentInitialCode.current) {
      hasSentInitialCode.current = true;
      sendVerificationCode();
    }
  }, []);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const sendVerificationCode = async () => {
    setIsSending(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          email: userEmail,
          purpose: 'signup',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      setCodeSent(true);
      setResendCooldown(60); // 60 second cooldown
      setSuccess('Verification code sent to your email!');

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setIsSending(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (value && index === 5 && newCode.every(d => d !== '')) {
      verifyCode(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      // Move focus to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();

    // Only accept 6-digit codes
    if (/^\d{6}$/.test(pastedData)) {
      const newCode = pastedData.split('');
      setCode(newCode);
      inputRefs.current[5]?.focus();
      verifyCode(pastedData);
    }
  };

  const verifyCode = async (codeString?: string) => {
    const codeToVerify = codeString || code.join('');

    if (codeToVerify.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          code: codeToVerify,
          purpose: 'signup',
          enableTwoFactor: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setSuccess('Email verified! 2FA has been enabled.');

      // Wait a moment then proceed
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
      // Clear the code on error
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center">
          <img src="/logo.png" alt="Aiuiw" className="h-16 w-auto mx-auto brightness-90 mb-6" />
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-sky/20 mb-6">
            <svg className="h-8 w-8 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Verify Your Email</h1>
          <p className="mt-2 text-sm text-foreground/60">
            We've sent a 6-digit code to
          </p>
          <p className="text-sm font-medium text-sky">{userEmail}</p>
        </div>

        {/* Code Input */}
        <div className="rounded-2xl border border-white/40 bg-white/60 backdrop-blur-md p-6">
          <div className="flex justify-center gap-2 mb-6">
            {code.map((digit, index) => (
              <input
                key={index}
                ref={el => { inputRefs.current[index] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleCodeChange(index, e.target.value)}
                onKeyDown={e => handleKeyDown(index, e)}
                onPaste={index === 0 ? handlePaste : undefined}
                disabled={isLoading}
                className="w-12 h-14 text-center text-2xl font-bold rounded-md border border-foreground/20 bg-white/80 text-foreground focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky disabled:opacity-50"
                autoFocus={index === 0}
              />
            ))}
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/20">
              <p className="text-sm text-red-600 text-center">{error}</p>
            </div>
          )}

          {/* Success message */}
          {success && (
            <div className="mb-4 p-3 rounded-md bg-green-500/10 border border-green-500/20">
              <p className="text-sm text-emerald-600 text-center">{success}</p>
            </div>
          )}

          {/* Verify button */}
          <button
            onClick={() => verifyCode()}
            disabled={isLoading || code.some(d => d === '')}
            className="w-full rounded-full rainbow-gradient border border-foreground/30 px-4 py-3 text-sm font-semibold text-foreground hover:shadow-md focus:outline-none focus:ring-2 focus:ring-sky focus:ring-offset-2 focus:ring-offset-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {isLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Verifying...
              </span>
            ) : (
              'Verify Code'
            )}
          </button>

          {/* Resend code */}
          <div className="mt-4 text-center">
            <p className="text-sm text-foreground/60 mb-2">Didn't receive the code?</p>
            <button
              onClick={sendVerificationCode}
              disabled={isSending || resendCooldown > 0}
              className="text-sm text-sky hover:text-sky/80 disabled:text-foreground/40 disabled:cursor-not-allowed"
            >
              {isSending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Code'}
            </button>
          </div>
        </div>

        {/* Info box */}
        <div className="rounded-2xl border border-white/40 bg-white/40 backdrop-blur-md p-4">
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 text-sky mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm text-foreground font-medium">Why email verification?</p>
              <p className="text-xs text-foreground/60 mt-1">
                Two-factor authentication adds an extra layer of security to your account.
                Every time you log in, we'll send a verification code to your email.
              </p>
            </div>
          </div>
        </div>

        {/* Back / Sign out buttons */}
        <div className="text-center space-y-2">
          {onBack && (
            <button
              onClick={onBack}
              className="text-sm text-foreground/60 hover:text-foreground block w-full"
            >
              Go back
            </button>
          )}
          <button
            onClick={async () => {
              const { supabase } = await import('@/lib/supabaseClient');
              await supabase.auth.signOut();
              window.location.href = '/auth';
            }}
            className="text-sm text-red-500 hover:text-red-400"
          >
            Sign out and start over
          </button>
        </div>
      </div>
    </div>
  );
}
