'use client';

/**
 * Encryption Context
 *
 * Manages client-side encryption keys for conversation history.
 *
 * Flow:
 * 1. User sets up encryption password → key bundle stored on server
 * 2. User logs in → prompted for encryption password
 * 3. Password derives KEK → unwraps data key → stored in DataKeyManager
 * 4. Data key used to encrypt/decrypt messages
 *
 * The server stores wrapped keys it cannot decrypt without the password.
 *
 * Architecture (Phase 2):
 * - DataKeyManager: Manages key lifecycle independently from React
 * - State Machine: Explicit state transitions replace boolean flags
 * - Backwards Compatible: toLegacyState() maintains existing API
 */

import React, { createContext, useContext, useReducer, useCallback, useEffect, useState } from 'react';
import { useAuthSession } from '@/hooks/useAuthSession';
import { supabase } from '@/lib/supabaseClient';
import {
  encrypt,
  decrypt,
  encryptJSON,
  decryptJSON,
  isEncrypted,
  type EncryptionKeyBundle,
  type RecoveryCodeBundle,
} from '@/lib/encryption';
import { EncryptionError } from '@/lib/encryptionErrors';
import { getDataKeyManager } from '@/lib/dataKeyManager';
import {
  encryptionReducer,
  initialEncryptionState,
  toLegacyState,
  isEncryptionReady as checkIsReady,
  type EncryptionState as MachineState,
  type EncryptionAction,
} from '@/lib/encryptionStateMachine';

/**
 * Helper to get auth headers for API requests
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('No active session');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
  };
}

// Legacy state interface (maintained for backwards compatibility)
interface EncryptionState {
  isLoading: boolean;
  hasEncryption: boolean;
  isUnlocked: boolean;
  keyBundle: EncryptionKeyBundle | null;
  recoveryBundle: RecoveryCodeBundle | null;
  remainingRecoveryCodes: number;
}

interface EncryptionContextType {
  // State (legacy format for backwards compatibility)
  state: EncryptionState;
  isReady: boolean;

  // New: Machine state for advanced usage
  machineState: MachineState;

  // Encryption functions
  encryptText: (plaintext: string) => Promise<string>;
  decryptText: (ciphertext: string) => Promise<string>;
  encryptObject: <T>(data: T) => Promise<string>;
  decryptObject: <T>(ciphertext: string) => Promise<T>;
  isEncryptedData: (data: string) => boolean;

  // Setup and unlock functions
  refreshEncryptionState: () => Promise<void>;
  setDataKey: (key: CryptoKey) => void;
  clearDataKey: () => void;

  // Modals
  showSetupModal: boolean;
  showUnlockModal: boolean;
  setShowSetupModal: (show: boolean) => void;
  setShowUnlockModal: (show: boolean) => void;

  // Save to server
  saveEncryptionSetup: (
    keyBundle: EncryptionKeyBundle,
    recoveryBundle: RecoveryCodeBundle,
    deliveryMethod: string
  ) => Promise<void>;

  // Mark recovery code as used
  markRecoveryCodeUsed: (
    updatedBundle: RecoveryCodeBundle,
    usedCodeHash: string
  ) => Promise<void>;
}

const EncryptionContext = createContext<EncryptionContextType | undefined>(undefined);

// Get the singleton DataKeyManager
const keyManager = typeof window !== 'undefined' ? getDataKeyManager() : null;

export function EncryptionProvider({ children }: { children: React.ReactNode }) {
  const { user, loadingUser } = useAuthSession();

  // State machine for encryption lifecycle
  const [machineState, dispatch] = useReducer(encryptionReducer, initialEncryptionState);

  // Modal visibility
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  // Track if key manager has a key (for state synchronization)
  const [hasKey, setHasKey] = useState(false);

  // Subscribe to DataKeyManager state changes
  useEffect(() => {
    if (!keyManager) return;

    const unsubscribe = keyManager.subscribe((keyState) => {
      setHasKey(keyState.status === 'loaded');
    });

    return unsubscribe;
  }, []);

  /**
   * Fetch encryption state from server
   */
  const refreshEncryptionState = useCallback(async () => {
    if (!user?.id) {
      dispatch({ type: 'RESET' });
      return;
    }

    dispatch({ type: 'START_CHECK' });

    try {
      // Wait for key manager to finish restoring from session
      if (keyManager) {
        await keyManager.waitForInit();
      }

      // Get auth headers (may fail if no session yet)
      let headers: Record<string, string>;
      try {
        headers = await getAuthHeaders();
      } catch {
        // No session yet - treat as no encryption
        dispatch({ type: 'CHECK_COMPLETE', hasEncryption: false });
        return;
      }

      const response = await fetch('/api/encryption', {
        method: 'GET',
        headers,
      });

      // Handle 401 (not authenticated yet) gracefully
      if (response.status === 401) {
        dispatch({ type: 'CHECK_COMPLETE', hasEncryption: false });
        return;
      }

      if (!response.ok) {
        throw new EncryptionError('UNKNOWN', 'Failed to fetch encryption state');
      }

      const data = await response.json();

      // Check if we already have a key from session restoration
      const keyFromSession = keyManager?.hasKey() ?? false;

      if (!data.hasEncryption) {
        dispatch({ type: 'CHECK_COMPLETE', hasEncryption: false });
      } else if (keyFromSession) {
        // Key was restored from session, go directly to unlocked
        dispatch({
          type: 'UNLOCK_SUCCESS',
          remainingRecoveryCodes: data.recoveryCodesStatus?.remaining || 0,
        });
      } else {
        // Encryption is set up but needs unlock
        dispatch({
          type: 'CHECK_COMPLETE',
          hasEncryption: true,
          keyBundle: data.keyBundle,
          recoveryBundle: data.recoveryBundle,
          remainingRecoveryCodes: data.recoveryCodesStatus?.remaining || 0,
        });
        // Show unlock modal
        setShowUnlockModal(true);
      }
    } catch (err) {
      console.error('[Encryption] Failed to fetch state:', err);
      const error = err instanceof EncryptionError
        ? err
        : new EncryptionError('UNKNOWN', 'Failed to fetch encryption state');
      dispatch({ type: 'CHECK_FAILED', error });
    }
  }, [user?.id]);

  /**
   * Initialize encryption state when user logs in
   */
  useEffect(() => {
    // Don't do anything while auth is still loading
    if (loadingUser) {
      return;
    }

    if (user?.id) {
      refreshEncryptionState();
    } else {
      // User logged out - clear everything
      keyManager?.clearKey();
      dispatch({ type: 'RESET' });
    }
  }, [user?.id, loadingUser, refreshEncryptionState]);

  /**
   * Set the data key (after successful password/recovery code unlock)
   */
  const setDataKey = useCallback((key: CryptoKey) => {
    if (keyManager) {
      keyManager.setKey(key).then(() => {
        // Get remaining recovery codes from current state
        let remainingCodes = 0;
        if (machineState.type === 'locked') {
          remainingCodes = machineState.remainingRecoveryCodes;
        }
        dispatch({ type: 'UNLOCK_SUCCESS', remainingRecoveryCodes: remainingCodes });
        setShowUnlockModal(false);
      }).catch((err) => {
        console.error('[Encryption] Failed to set key:', err);
        dispatch({
          type: 'UNLOCK_FAILED',
          error: new EncryptionError('EXPORT_FAILED', 'Failed to save encryption key'),
        });
      });
    }
  }, [machineState]);

  /**
   * Clear the data key (on logout or lock)
   */
  const clearDataKey = useCallback(() => {
    keyManager?.clearKey();
    dispatch({ type: 'LOCK' });
  }, []);

  /**
   * Save encryption setup to server
   */
  const saveEncryptionSetup = useCallback(async (
    keyBundle: EncryptionKeyBundle,
    recoveryBundle: RecoveryCodeBundle,
    deliveryMethod: string
  ) => {
    const headers = await getAuthHeaders();

    const response = await fetch('/api/encryption', {
      method: 'POST',
      headers,
      body: JSON.stringify({ keyBundle, recoveryBundle, deliveryMethod }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to save encryption setup');
    }

    // Dispatch setup complete
    dispatch({ type: 'SETUP_COMPLETE', keyBundle, recoveryBundle });
  }, []);

  /**
   * Mark a recovery code as used
   */
  const markRecoveryCodeUsed = useCallback(async (
    updatedBundle: RecoveryCodeBundle,
    usedCodeHash: string
  ) => {
    const headers = await getAuthHeaders();

    const response = await fetch('/api/encryption', {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        action: 'mark_code_used',
        recoveryBundle: updatedBundle,
        usedCodeHash,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update recovery codes');
    }

    // Note: State machine doesn't track recovery codes in detail
    // The unlock flow handles this
  }, []);

  /**
   * Get current key from manager
   */
  const getKey = useCallback((): CryptoKey => {
    if (!keyManager || !keyManager.hasKey()) {
      throw new EncryptionError('LOCKED', 'Encryption not unlocked. Please enter your encryption password.');
    }
    return keyManager.getKey();
  }, []);

  /**
   * Encrypt plaintext string (throws if not unlocked)
   */
  const encryptText = useCallback(async (plaintext: string): Promise<string> => {
    const key = getKey();
    try {
      return await encrypt(plaintext, key);
    } catch (err) {
      throw new EncryptionError('UNKNOWN', 'Failed to encrypt data', {
        originalError: err instanceof Error ? err : undefined,
      });
    }
  }, [getKey]);

  /**
   * Decrypt ciphertext string
   */
  const decryptText = useCallback(async (ciphertext: string): Promise<string> => {
    const key = getKey();

    // If not encrypted, return as-is (backwards compatibility)
    if (!isEncrypted(ciphertext)) {
      return ciphertext;
    }

    try {
      return await decrypt(ciphertext, key);
    } catch (err) {
      const message = err instanceof Error ? err.message.toLowerCase() : '';
      if (message.includes('tag') || message.includes('authentication')) {
        throw new EncryptionError('KEY_MISMATCH', 'Data was encrypted with a different key', {
          originalError: err instanceof Error ? err : undefined,
        });
      }
      throw new EncryptionError('CORRUPTED_DATA', 'Failed to decrypt data - may be corrupted', {
        originalError: err instanceof Error ? err : undefined,
      });
    }
  }, [getKey]);

  /**
   * Encrypt a JSON object
   */
  const encryptObject = useCallback(async <T,>(data: T): Promise<string> => {
    const key = getKey();
    try {
      return await encryptJSON(data, key);
    } catch (err) {
      throw new EncryptionError('UNKNOWN', 'Failed to encrypt data', {
        originalError: err instanceof Error ? err : undefined,
      });
    }
  }, [getKey]);

  /**
   * Decrypt to a JSON object
   */
  const decryptObject = useCallback(async <T,>(ciphertext: string): Promise<T> => {
    const key = getKey();

    if (!isEncrypted(ciphertext)) {
      try {
        return JSON.parse(ciphertext);
      } catch {
        throw new EncryptionError('INVALID_FORMAT', 'Data is not valid JSON');
      }
    }

    try {
      return await decryptJSON<T>(ciphertext, key);
    } catch (err) {
      const message = err instanceof Error ? err.message.toLowerCase() : '';
      if (message.includes('tag') || message.includes('authentication')) {
        throw new EncryptionError('KEY_MISMATCH', 'Data was encrypted with a different key', {
          originalError: err instanceof Error ? err : undefined,
        });
      }
      throw new EncryptionError('CORRUPTED_DATA', 'Failed to decrypt data - may be corrupted', {
        originalError: err instanceof Error ? err : undefined,
      });
    }
  }, [getKey]);

  /**
   * Check if data is encrypted
   */
  const isEncryptedData = useCallback((data: string): boolean => {
    return isEncrypted(data);
  }, []);

  // Convert machine state to legacy format
  const legacyState = toLegacyState(machineState);

  // Override isUnlocked based on actual key presence
  const state: EncryptionState = {
    ...legacyState,
    isUnlocked: hasKey,
  };

  // Determine if encryption is ready for use
  const isReady = checkIsReady(machineState) || (machineState.type === 'unlocked');

  return (
    <EncryptionContext.Provider
      value={{
        state,
        isReady,
        machineState,
        encryptText,
        decryptText,
        encryptObject,
        decryptObject,
        isEncryptedData,
        refreshEncryptionState,
        setDataKey,
        clearDataKey,
        showSetupModal,
        showUnlockModal,
        setShowSetupModal,
        setShowUnlockModal,
        saveEncryptionSetup,
        markRecoveryCodeUsed,
      }}
    >
      {children}
    </EncryptionContext.Provider>
  );
}

/**
 * Hook to access encryption functions.
 * Returns a "not ready" state if used outside EncryptionProvider.
 */
export function useEncryption(): EncryptionContextType {
  const context = useContext(EncryptionContext);

  // If no context, return a safe fallback
  if (context === undefined) {
    return {
      state: {
        isLoading: true,
        hasEncryption: false,
        isUnlocked: false,
        keyBundle: null,
        recoveryBundle: null,
        remainingRecoveryCodes: 0,
      },
      isReady: false,
      machineState: { type: 'uninitialized' },
      encryptText: async () => { throw new Error('Encryption not available - EncryptionProvider not found'); },
      decryptText: async () => { throw new Error('Encryption not available - EncryptionProvider not found'); },
      encryptObject: async () => { throw new Error('Encryption not available - EncryptionProvider not found'); },
      decryptObject: async () => { throw new Error('Encryption not available - EncryptionProvider not found'); },
      isEncryptedData: () => false,
      refreshEncryptionState: async () => {},
      setDataKey: () => {},
      clearDataKey: () => {},
      showSetupModal: false,
      showUnlockModal: false,
      setShowSetupModal: () => {},
      setShowUnlockModal: () => {},
      saveEncryptionSetup: async () => {},
      markRecoveryCodeUsed: async () => {},
    };
  }

  return context;
}
