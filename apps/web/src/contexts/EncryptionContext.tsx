'use client';

/**
 * Encryption Context
 *
 * Manages client-side encryption keys for conversation history.
 *
 * Flow:
 * 1. User sets up encryption password → key bundle stored on server
 * 2. User logs in → prompted for encryption password
 * 3. Password derives KEK → unwraps data key → stored in memory
 * 4. Data key used to encrypt/decrypt messages
 *
 * The server stores wrapped keys it cannot decrypt without the password.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
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

interface EncryptionState {
  isLoading: boolean;
  hasEncryption: boolean;
  isUnlocked: boolean;
  keyBundle: EncryptionKeyBundle | null;
  recoveryBundle: RecoveryCodeBundle | null;
  remainingRecoveryCodes: number;
}

interface EncryptionContextType {
  // State
  state: EncryptionState;
  isReady: boolean;

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

// In-memory data key
let cachedDataKey: CryptoKey | null = null;

// Session storage key for persisting the data key
const SESSION_KEY_STORAGE = 'encryption_session_key';

/**
 * Save the data key to sessionStorage (persists for browser session)
 */
async function saveKeyToSession(key: CryptoKey): Promise<void> {
  try {
    // Export key as JWK (JSON Web Key)
    const jwk = await crypto.subtle.exportKey('jwk', key);
    sessionStorage.setItem(SESSION_KEY_STORAGE, JSON.stringify(jwk));
  } catch (error) {
    console.error('[Encryption] Failed to save key to session:', error);
  }
}

/**
 * Load the data key from sessionStorage
 */
async function loadKeyFromSession(): Promise<CryptoKey | null> {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY_STORAGE);
    if (!stored) return null;

    const jwk = JSON.parse(stored);
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'AES-GCM', length: 256 },
      false, // Not extractable after import (more secure)
      ['encrypt', 'decrypt']
    );
    return key;
  } catch (error) {
    console.error('[Encryption] Failed to load key from session:', error);
    // Clear corrupted data
    sessionStorage.removeItem(SESSION_KEY_STORAGE);
    return null;
  }
}

/**
 * Clear the data key from sessionStorage
 */
function clearKeyFromSession(): void {
  sessionStorage.removeItem(SESSION_KEY_STORAGE);
}

export function EncryptionProvider({ children }: { children: React.ReactNode }) {
  const { user, loadingUser } = useAuthSession();

  const [state, setState] = useState<EncryptionState>({
    isLoading: true,
    hasEncryption: false,
    isUnlocked: false,
    keyBundle: null,
    recoveryBundle: null,
    remainingRecoveryCodes: 0,
  });

  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);

  /**
   * Fetch encryption state from server
   * Also attempts to restore key from sessionStorage on page refresh
   */
  const refreshEncryptionState = useCallback(async () => {
    if (!user?.id) {
      setState({
        isLoading: false,
        hasEncryption: false,
        isUnlocked: false,
        keyBundle: null,
        recoveryBundle: null,
        remainingRecoveryCodes: 0,
      });
      return;
    }

    try {
      // Try to restore key from session storage first (handles page refresh)
      if (!cachedDataKey) {
        const sessionKey = await loadKeyFromSession();
        if (sessionKey) {
          cachedDataKey = sessionKey;
        }
      }

      // Get auth headers (may fail if no session yet)
      let headers: Record<string, string>;
      try {
        headers = await getAuthHeaders();
      } catch {
        // No session yet - treat as no encryption
        setState({
          isLoading: false,
          hasEncryption: false,
          isUnlocked: false,
          keyBundle: null,
          recoveryBundle: null,
          remainingRecoveryCodes: 0,
        });
        return;
      }

      const response = await fetch('/api/encryption', {
        method: 'GET',
        headers,
      });

      // Handle 401 (not authenticated yet) gracefully - treat as no encryption
      if (response.status === 401) {
        setState({
          isLoading: false,
          hasEncryption: false,
          isUnlocked: false,
          keyBundle: null,
          recoveryBundle: null,
          remainingRecoveryCodes: 0,
        });
        return;
      }

      if (!response.ok) {
        throw new Error('Failed to fetch encryption state');
      }

      const data = await response.json();

      setState({
        isLoading: false,
        hasEncryption: data.hasEncryption,
        isUnlocked: !!cachedDataKey,
        keyBundle: data.keyBundle || null,
        recoveryBundle: data.recoveryBundle || null,
        remainingRecoveryCodes: data.recoveryCodesStatus?.remaining || 0,
      });

      // If encryption is set up but not unlocked, show unlock modal
      // (only if we couldn't restore from session)
      if (data.hasEncryption && !cachedDataKey) {
        setShowUnlockModal(true);
      }
    } catch (error) {
      console.error('[Encryption] Failed to fetch state:', error);
      setState(prev => ({ ...prev, isLoading: false }));
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
      // User explicitly logged out (not just initial load)
      // Clear state and session storage
      cachedDataKey = null;
      clearKeyFromSession();
      setState({
        isLoading: false,
        hasEncryption: false,
        isUnlocked: false,
        keyBundle: null,
        recoveryBundle: null,
        remainingRecoveryCodes: 0,
      });
    }
  }, [user?.id, loadingUser, refreshEncryptionState]);

  /**
   * Set the data key (after successful password/recovery code unlock)
   * Also persists to sessionStorage for the browser session
   */
  const setDataKey = useCallback((key: CryptoKey) => {
    cachedDataKey = key;
    setState(prev => ({ ...prev, isUnlocked: true }));
    setShowUnlockModal(false);
    // Persist to session storage (async, but we don't need to wait)
    saveKeyToSession(key);
  }, []);

  /**
   * Clear the data key (on logout or lock)
   * Also clears from sessionStorage
   */
  const clearDataKey = useCallback(() => {
    cachedDataKey = null;
    clearKeyFromSession();
    setState(prev => ({ ...prev, isUnlocked: false }));
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

    // Update local state
    setState(prev => ({
      ...prev,
      hasEncryption: true,
      keyBundle,
      recoveryBundle,
      remainingRecoveryCodes: recoveryBundle.codeHashes.length,
    }));
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

    const data = await response.json();

    // Update local state
    setState(prev => ({
      ...prev,
      recoveryBundle: updatedBundle,
      remainingRecoveryCodes: data.remainingCodes,
    }));
  }, []);

  /**
   * Encrypt plaintext string (throws if not unlocked)
   */
  const encryptText = useCallback(async (plaintext: string): Promise<string> => {
    if (!cachedDataKey) {
      throw new Error('Encryption not unlocked. Please enter your encryption password.');
    }
    return encrypt(plaintext, cachedDataKey);
  }, []);

  /**
   * Decrypt ciphertext string
   * Returns original if not encrypted (for backwards compatibility)
   */
  const decryptText = useCallback(async (ciphertext: string): Promise<string> => {
    if (!cachedDataKey) {
      throw new Error('Encryption not unlocked. Please enter your encryption password.');
    }

    // If not encrypted, return as-is (backwards compatibility)
    if (!isEncrypted(ciphertext)) {
      return ciphertext;
    }

    return await decrypt(ciphertext, cachedDataKey);
  }, []);

  /**
   * Encrypt a JSON object
   */
  const encryptObject = useCallback(async <T,>(data: T): Promise<string> => {
    if (!cachedDataKey) {
      throw new Error('Encryption not unlocked. Please enter your encryption password.');
    }
    return encryptJSON(data, cachedDataKey);
  }, []);

  /**
   * Decrypt to a JSON object
   */
  const decryptObject = useCallback(async <T,>(ciphertext: string): Promise<T> => {
    if (!cachedDataKey) {
      throw new Error('Encryption not unlocked. Please enter your encryption password.');
    }

    if (!isEncrypted(ciphertext)) {
      return JSON.parse(ciphertext);
    }

    return await decryptJSON<T>(ciphertext, cachedDataKey);
  }, []);

  /**
   * Check if data is encrypted
   */
  const isEncryptedData = useCallback((data: string): boolean => {
    return isEncrypted(data);
  }, []);

  // Determine if encryption is ready for use
  const isReady = !state.isLoading && (!state.hasEncryption || state.isUnlocked);

  return (
    <EncryptionContext.Provider
      value={{
        state,
        isReady,
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
