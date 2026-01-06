/**
 * Two-Factor Login Component
 *
 * Displayed after password authentication for users with 2FA enabled.
 * User must enter the 6-digit code sent to their email.
 */

"use client";

import React, { useState, useEffect, useRef } from 'react';
import { getCSRFToken } from '@/hooks/useCSRF';

type TwoFactorLoginProps = {
  userId: string;
  userEmail: string;
  onVerified: () => void;
  onCancel: () => void;
};

export default function TwoFactorLogin({
  userId,
  userEmail,
  onVerified,
  onCancel,
}: TwoFactorLoginProps) {
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
      const csrfToken = getCSRFToken();
      const response = await fetch('/api/auth/send-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        body: JSON.stringify({
          userId,
          email: userEmail,
          purpose: 'login',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send verification code');
      }

      setCodeSent(true);
      setResendCooldown(60);
      setSuccess('Verification code sent!');

      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to send verification code');
    } finally {
      setIsSending(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (value && index === 5 && newCode.every(d => d !== '')) {
      verifyCode(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').trim();

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
      const csrfToken = getCSRFToken();
      const response = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        body: JSON.stringify({
          userId,
          code: codeToVerify,
          purpose: 'login',
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Verification failed');
      }

      setSuccess('Verified! Signing you in...');
      setTimeout(() => onVerified(), 1000);
    } catch (err: any) {
      setError(err.message || 'Verification failed');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  // Mask email for privacy
  const maskedEmail = userEmail.replace(/(.{2})(.*)(@.*)/, '$1***$3');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-sky/30 mb-4">
          <svg className="h-6 w-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-foreground">Two-Factor Authentication</h2>
        <p className="mt-2 text-sm text-foreground/60">
          Enter the code sent to {maskedEmail}
        </p>
      </div>

      {/* Code Input */}
      <div className="flex justify-center gap-2">
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
            className="w-10 h-12 text-center text-xl font-bold rounded-md border border-foreground/20 bg-gradient-to-br from-butter/40 via-mint/30 to-sky/40 text-foreground focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky disabled:opacity-50"
            autoFocus={index === 0}
          />
        ))}
      </div>

      {/* Error message */}
      {error && (
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400 text-center">{error}</p>
        </div>
      )}

      {/* Success message */}
      {success && (
        <div className="p-3 rounded-md bg-green-500/10 border border-green-500/20">
          <p className="text-sm text-green-400 text-center">{success}</p>
        </div>
      )}

      {/* Verify button */}
      <button
        onClick={() => verifyCode()}
        disabled={isLoading || code.some(d => d === '')}
        className="w-full rounded-full bg-white/60 border border-foreground/30 px-4 py-2 text-sm font-semibold text-foreground hover:bg-white/80 focus:outline-none focus:ring-2 focus:ring-sky focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Verifying...' : 'Verify'}
      </button>

      {/* Resend / Cancel */}
      <div className="flex items-center justify-between text-sm">
        <button
          onClick={sendVerificationCode}
          disabled={isSending || resendCooldown > 0}
          className="text-foreground hover:text-foreground/80 disabled:text-foreground/40 disabled:cursor-not-allowed"
        >
          {isSending ? 'Sending...' : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
        </button>
        <button
          onClick={onCancel}
          className="text-foreground/60 hover:text-foreground/80"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
