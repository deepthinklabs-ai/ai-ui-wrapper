"use client";

/**
 * EncryptionUnlockModal Component
 *
 * Modal for unlocking encrypted messages on a new device or session.
 * User can either:
 * 1. Enter their encryption password
 * 2. Use a recovery code
 */

import React, { useState, useCallback } from 'react';
import {
  unlockDataKey,
  recoverWithCode,
  markRecoveryCodeUsed,
  getRemainingRecoveryCodeCount,
  type EncryptionKeyBundle,
  type RecoveryCodeBundle,
} from '@/lib/encryption';

type EncryptionUnlockModalProps = {
  isOpen: boolean;
  keyBundle: EncryptionKeyBundle;
  recoveryBundle: RecoveryCodeBundle | null;
  onUnlock: (dataKey: CryptoKey, updatedRecoveryBundle?: RecoveryCodeBundle) => Promise<void>;
  onCancel?: () => void;
};

type UnlockMethod = 'password' | 'recovery-code';

export default function EncryptionUnlockModal({
  isOpen,
  keyBundle,
  recoveryBundle,
  onUnlock,
  onCancel,
}: EncryptionUnlockModalProps) {
  const [method, setMethod] = useState<UnlockMethod>('password');
  const [password, setPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [error, setError] = useState('');
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const remainingCodes = recoveryBundle
    ? getRemainingRecoveryCodeCount(recoveryBundle)
    : 0;

  const handlePasswordUnlock = useCallback(async () => {
    if (!password.trim()) {
      setError('Please enter your encryption password');
      return;
    }

    setError('');
    setIsUnlocking(true);

    try {
      const dataKey = await unlockDataKey(password, keyBundle);
      await onUnlock(dataKey);
    } catch (err) {
      console.error('[Encryption Unlock] Password failed:', err);
      setError('Incorrect password. Please try again.');
    } finally {
      setIsUnlocking(false);
    }
  }, [password, keyBundle, onUnlock]);

  const handleRecoveryCodeUnlock = useCallback(async () => {
    if (!recoveryCode.trim()) {
      setError('Please enter a recovery code');
      return;
    }

    if (!recoveryBundle) {
      setError('No recovery codes are set up for this account');
      return;
    }

    setError('');
    setIsUnlocking(true);

    try {
      const result = await recoverWithCode(recoveryCode.toUpperCase(), recoveryBundle);

      if (!result) {
        setError('Invalid recovery code. Please check and try again.');
        setIsUnlocking(false);
        return;
      }

      // Mark the code as used
      const updatedBundle = markRecoveryCodeUsed(recoveryBundle, result.codeHash);

      await onUnlock(result.dataKey, updatedBundle);
    } catch (err: any) {
      console.error('[Encryption Unlock] Recovery failed:', err);
      if (err.message?.includes('already been used')) {
        setError('This recovery code has already been used. Please try another.');
      } else {
        setError('Failed to recover. Please check your code and try again.');
      }
    } finally {
      setIsUnlocking(false);
    }
  }, [recoveryCode, recoveryBundle, onUnlock]);

  const handleSubmit = useCallback(() => {
    if (method === 'password') {
      handlePasswordUnlock();
    } else {
      handleRecoveryCodeUnlock();
    }
  }, [method, handlePasswordUnlock, handleRecoveryCodeUnlock]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isUnlocking) {
      handleSubmit();
    }
  }, [handleSubmit, isUnlocking]);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop - softer to match pastel theme */}
      <div className="fixed inset-0 bg-foreground/30 backdrop-blur-sm z-40" />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-2xl border border-white/40 bg-white/80 backdrop-blur-xl shadow-2xl">
          {/* Header */}
          <div className="border-b border-foreground/10 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sky/30">
                <svg className="h-6 w-6 text-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Unlock Your Messages</h2>
                <p className="text-sm text-foreground/60">Enter your encryption password to continue</p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-6 space-y-5">
            {/* Method Tabs */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setMethod('password');
                  setError('');
                }}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  method === 'password'
                    ? 'bg-sky/30 text-foreground border border-sky/50'
                    : 'bg-white/60 text-foreground/60 border border-foreground/20 hover:text-foreground'
                }`}
              >
                Password
              </button>
              <button
                onClick={() => {
                  setMethod('recovery-code');
                  setError('');
                }}
                disabled={!recoveryBundle || remainingCodes === 0}
                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  method === 'recovery-code'
                    ? 'bg-sky/30 text-foreground border border-sky/50'
                    : 'bg-white/60 text-foreground/60 border border-foreground/20 hover:text-foreground'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Recovery Code
                {recoveryBundle && remainingCodes > 0 && (
                  <span className="ml-1 text-xs opacity-60">({remainingCodes} left)</span>
                )}
              </button>
            </div>

            {/* Password Input */}
            {method === 'password' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Encryption Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter your encryption password"
                    autoFocus
                    className="w-full rounded-lg border border-foreground/20 bg-white/80 px-4 py-3 pr-10 text-foreground placeholder-foreground/40 focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/60"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="mt-2 text-xs text-foreground/50">
                  This is separate from your login password. It was set when you enabled encryption.
                </p>
              </div>
            )}

            {/* Recovery Code Input */}
            {method === 'recovery-code' && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Recovery Code
                </label>
                <input
                  type="text"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                  onKeyDown={handleKeyDown}
                  placeholder="XXXX-XXXX-XXXX"
                  autoFocus
                  maxLength={14}
                  className="w-full rounded-lg border border-foreground/20 bg-white/80 px-4 py-3 text-foreground placeholder-foreground/40 font-mono tracking-wider focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky"
                />
                <p className="mt-2 text-xs text-foreground/50">
                  Enter one of your saved recovery codes. Each code can only be used once.
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Info Box */}
            <div className="rounded-lg border border-foreground/10 bg-mint/20 p-4">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 flex-shrink-0 text-foreground/60 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="text-xs text-foreground/60">
                  <p className="font-medium text-foreground mb-1">Zero-Knowledge Encryption</p>
                  <p>Your messages are encrypted on your device. We cannot access them without your password or recovery codes.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-foreground/10 px-6 py-4">
            <div className="flex gap-3">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="flex-1 rounded-lg border border-foreground/30 bg-white/60 px-4 py-3 text-sm font-medium text-foreground hover:bg-white/80 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={isUnlocking || (method === 'password' ? !password : !recoveryCode)}
                className="flex-1 rounded-full rainbow-gradient border border-foreground/30 px-4 py-3 text-sm font-semibold text-foreground hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUnlocking ? 'Unlocking...' : 'Unlock Messages'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
