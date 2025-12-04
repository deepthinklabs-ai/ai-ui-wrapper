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
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40" />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
          {/* Header */}
          <div className="border-b border-slate-800 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-cyan-600">
                <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-100">Unlock Your Messages</h2>
                <p className="text-sm text-slate-400">Enter your encryption password to continue</p>
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
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-300'
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
                    ? 'bg-blue-500/20 text-blue-300 border border-blue-500/50'
                    : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-300'
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
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Encryption Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter your encryption password"
                  autoFocus
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-slate-100 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="mt-2 text-xs text-slate-500">
                  This is separate from your login password. It was set when you enabled encryption.
                </p>
              </div>
            )}

            {/* Recovery Code Input */}
            {method === 'recovery-code' && (
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
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
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-4 py-3 text-slate-100 placeholder-slate-500 font-mono tracking-wider focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Enter one of your saved recovery codes. Each code can only be used once.
                </p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Info Box */}
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 flex-shrink-0 text-slate-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="text-xs text-slate-400">
                  <p className="font-medium text-slate-300 mb-1">Zero-Knowledge Encryption</p>
                  <p>Your messages are encrypted on your device. We cannot access them without your password or recovery codes.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-slate-800 px-6 py-4">
            <div className="flex gap-3">
              {onCancel && (
                <button
                  onClick={onCancel}
                  className="flex-1 rounded-lg border border-slate-600 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleSubmit}
                disabled={isUnlocking || (method === 'password' ? !password : !recoveryCode)}
                className="flex-1 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-3 text-sm font-semibold text-white hover:from-blue-500 hover:to-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
