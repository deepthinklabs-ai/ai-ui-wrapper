"use client";

/**
 * EncryptionModals Component
 *
 * Wrapper component that renders the appropriate encryption modal
 * based on the current encryption state.
 */

import React, { useCallback } from 'react';
import { useEncryption } from '@/contexts/EncryptionContext';
import { useAuthSession } from '@/hooks/useAuthSession';
import { unlockDataKey } from '@/lib/encryption';
import type { EncryptionKeyBundle, RecoveryCodeBundle } from '@/lib/encryption';
import EncryptionSetupModal from './EncryptionSetupModal';
import EncryptionUnlockModal from './EncryptionUnlockModal';

export default function EncryptionModals() {
  const { user } = useAuthSession();
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
          onCancel={() => setShowUnlockModal(false)}
        />
      )}
    </>
  );
}
