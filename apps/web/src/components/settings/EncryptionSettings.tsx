"use client";

import React, { useState } from 'react';
import { useEncryption } from '@/contexts/EncryptionContext';
import EncryptionSetupOnboarding from '@/components/onboarding/EncryptionSetupOnboarding';
import type { EncryptionKeyBundle, RecoveryCodeBundle } from '@/lib/encryption';

interface EncryptionSettingsProps {
  userEmail?: string;
}

export default function EncryptionSettings({ userEmail }: EncryptionSettingsProps) {
  const { state, saveEncryptionSetup, setDataKey } = useEncryption();
  const [showSetupFlow, setShowSetupFlow] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetupComplete = async (
    keyBundle: EncryptionKeyBundle,
    recoveryBundle: RecoveryCodeBundle,
    deliveryMethod: string,
    dataKey: CryptoKey
  ) => {
    setIsSaving(true);
    setError(null);
    try {
      await saveEncryptionSetup(keyBundle, recoveryBundle, deliveryMethod);
      setDataKey(dataKey);
      setShowSetupFlow(false);
    } catch (err) {
      console.error('[Encryption Settings] Failed to save:', err);
      setError(err instanceof Error ? err.message : 'Failed to save encryption settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Show full-page setup flow
  if (showSetupFlow) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-950">
        <div className="absolute top-4 right-4">
          <button
            onClick={() => setShowSetupFlow(false)}
            className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <EncryptionSetupOnboarding
          userEmail={userEmail || ''}
          onComplete={handleSetupComplete}
          onBack={() => setShowSetupFlow(false)}
        />
      </div>
    );
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
          <svg className="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Message Encryption
        </h2>
        <p className="mt-2 text-sm text-slate-400">
          Encrypt your conversation history with a password only you know.
          We cannot read your messages - they're encrypted before leaving your device.
        </p>
      </div>

      {state.isLoading ? (
        <div className="flex items-center gap-3 text-slate-400">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <span>Loading encryption status...</span>
        </div>
      ) : state.hasEncryption ? (
        <div className="space-y-4">
          {/* Encryption Enabled Status */}
          <div className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-500/10 p-4">
            <div className="flex items-center gap-3">
              <svg className="h-6 w-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <div className="text-sm font-semibold text-green-300">Encryption Enabled</div>
                <div className="text-xs text-green-400/80">Your messages are protected with end-to-end encryption</div>
              </div>
            </div>
            {state.isUnlocked ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-500/20 px-3 py-1 text-xs font-medium text-green-300">
                <span className="h-1.5 w-1.5 rounded-full bg-green-400"></span>
                Unlocked
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-medium text-amber-300">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                Locked
              </span>
            )}
          </div>

          {/* Recovery Codes Status */}
          {state.remainingRecoveryCodes > 0 && (
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-slate-300">
                  <span className="font-medium">Recovery Codes:</span> {state.remainingRecoveryCodes} remaining
                </div>
                {state.remainingRecoveryCodes <= 3 && (
                  <span className="text-xs text-amber-400">Consider regenerating codes</span>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {/* Not Set Up Yet */}
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
              <svg className="h-6 w-6 text-amber-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <div className="text-sm font-semibold text-amber-300">Encryption Not Set Up</div>
                <div className="text-xs text-amber-400/80 mt-1">
                  Your messages are not currently encrypted. Set up encryption to protect your conversation history.
                </div>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={() => setShowSetupFlow(true)}
            disabled={isSaving}
            className="w-full rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:from-green-500 hover:to-emerald-500 transition-all disabled:opacity-50 shadow-lg shadow-green-500/25"
          >
            {isSaving ? 'Setting up...' : 'Set Up Encryption'}
          </button>

          <p className="text-xs text-slate-500 text-center">
            You'll create an encryption password and receive recovery codes.
          </p>
        </div>
      )}
    </section>
  );
}
