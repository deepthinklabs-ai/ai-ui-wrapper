"use client";

/**
 * EncryptionModals Component
 *
 * Wrapper component that renders the appropriate encryption modal
 * based on the current encryption state.
 */

import React, { useCallback, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useEncryption } from '@/contexts/EncryptionContext';
import { useAuthSession } from '@/hooks/useAuthSession';
import { unlockDataKey } from '@/lib/encryption';
import type { EncryptionKeyBundle, RecoveryCodeBundle } from '@/lib/encryption';
import EncryptionSetupModal from './EncryptionSetupModal';
import EncryptionUnlockModal from './EncryptionUnlockModal';

// Pages where encryption modals should NOT be shown
const EXCLUDED_PATHS = [
  '/auth',
  '/auth/reset-password',
  '/auth/callback',
];

export default function EncryptionModals() {
  const pathname = usePathname();
  const { user } = useAuthSession();
  const [unlockCancelled, setUnlockCancelled] = useState(false);
  const {
    state,
    showSetupModal,
    showUnlockModal,
    setShowSetupModal,
    setShowUnlockModal,
    saveEncryptionSetup,
    markRecoveryCodeUsed,
    setDataKey,
  } = useEncryption();

  /**
   * Handle encryption setup completion
   */
  const handleSetupComplete = useCallback(async (
    keyBundle: EncryptionKeyBundle,
    recoveryBundle: RecoveryCodeBundle,
    deliveryMethod: string
  ) => {
    // Save to server
    await saveEncryptionSetup(keyBundle, recoveryBundle, deliveryMethod);

    // Unlock immediately after setup (we have the password)
    // Note: The setup modal has the password, so we need to pass it here
    // For now, we'll just close the modal and the user will be prompted to unlock
    setShowSetupModal(false);
  }, [saveEncryptionSetup, setShowSetupModal]);

  /**
   * Handle unlock completion
   */
  const handleUnlock = useCallback(async (
    dataKey: CryptoKey,
    updatedRecoveryBundle?: RecoveryCodeBundle
  ) => {
    // Store the data key in memory
    setDataKey(dataKey);

    // If a recovery code was used, update the server
    if (updatedRecoveryBundle && state.recoveryBundle) {
      const usedCodeHash = updatedRecoveryBundle.usedCodes[
        updatedRecoveryBundle.usedCodes.length - 1
      ];
      await markRecoveryCodeUsed(updatedRecoveryBundle, usedCodeHash);
    }
  }, [setDataKey, markRecoveryCodeUsed, state.recoveryBundle]);

  // Don't render anything if still loading
  if (state.isLoading) {
    return null;
  }

  // Don't render on auth pages (login, password reset, etc.)
  if (pathname && EXCLUDED_PATHS.some(path => pathname.startsWith(path))) {
    return null;
  }

  return (
    <>
      {/* Setup Modal */}
      <EncryptionSetupModal
        isOpen={showSetupModal}
        onClose={() => setShowSetupModal(false)}
        onComplete={handleSetupComplete}
        userEmail={user?.email}
      />

      {/* Unlock Modal */}
      {state.keyBundle && (
        <EncryptionUnlockModal
          isOpen={showUnlockModal}
          keyBundle={state.keyBundle}
          recoveryBundle={state.recoveryBundle}
          onUnlock={handleUnlock}
          onCancel={() => {
            setShowUnlockModal(false);
            setUnlockCancelled(true);
          }}
        />
      )}

      {/* Cancelled Banner - shows when user cancelled the unlock modal */}
      {unlockCancelled && !showUnlockModal && state.keyBundle && !state.isUnlocked && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 backdrop-blur-sm px-6 py-4 shadow-lg">
            <div className="flex items-center gap-4">
              <svg className="h-5 w-5 text-amber-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="text-sm">
                <p className="text-amber-200 font-medium">Encryption not unlocked</p>
                <p className="text-amber-300/70">Your messages are encrypted and cannot be read.</p>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => {
                    setUnlockCancelled(false);
                    setShowUnlockModal(true);
                  }}
                  className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-slate-900 hover:bg-amber-400 transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="rounded-md border border-amber-500/50 px-3 py-1.5 text-sm font-medium text-amber-300 hover:bg-amber-500/20 transition-colors"
                >
                  Refresh Page
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
