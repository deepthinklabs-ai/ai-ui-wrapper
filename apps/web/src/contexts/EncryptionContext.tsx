'use client';

/**
 * Encryption Context
 *
 * Manages client-side encryption keys for conversation history.
 * Keys are generated per-device and stored in localStorage.
 * The server stores encrypted data it cannot read.
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useAuthSession } from '@/hooks/useAuthSession';
import { supabase } from '@/lib/supabaseClient';
import {
  encrypt,
  decrypt,
  encryptJSON,
  decryptJSON,
  generateDataKey,
  isEncrypted,
} from '@/lib/encryption';

interface EncryptionContextType {
  isReady: boolean;
  encryptText: (plaintext: string) => Promise<string>;
  decryptText: (ciphertext: string) => Promise<string>;
  encryptObject: <T>(data: T) => Promise<string>;
  decryptObject: <T>(ciphertext: string) => Promise<T>;
  isEncryptedData: (data: string) => boolean;
}

const EncryptionContext = createContext<EncryptionContextType | undefined>(undefined);

// LocalStorage key for the encryption key
const ENCRYPTION_KEY_STORAGE = 'aiuiw_encryption_key';

// In-memory key cache (for performance, avoids re-importing from localStorage)
let cachedDataKey: CryptoKey | null = null;

/**
 * Convert CryptoKey to storable format
 */
async function exportKey(key: CryptoKey): Promise<string> {
  const exported = await crypto.subtle.exportKey('raw', key);
  const bytes = new Uint8Array(exported);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Import key from stored format
 */
async function importKey(keyData: string): Promise<CryptoKey> {
  const binary = atob(keyData);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return crypto.subtle.importKey(
    'raw',
    bytes,
    { name: 'AES-GCM', length: 256 },
    false, // Not extractable for security
    ['encrypt', 'decrypt']
  );
}

/**
 * Get or create encryption key for the current user/device
 */
async function getOrCreateKey(userId: string): Promise<CryptoKey> {
  // Check memory cache first
  if (cachedDataKey) {
    return cachedDataKey;
  }

  const storageKey = `${ENCRYPTION_KEY_STORAGE}_${userId}`;

  // Check localStorage
  const storedKey = localStorage.getItem(storageKey);
  if (storedKey) {
    try {
      cachedDataKey = await importKey(storedKey);
      return cachedDataKey;
    } catch (err) {
      console.warn('[Encryption] Failed to import stored key, generating new one');
      localStorage.removeItem(storageKey);
    }
  }

  // Generate new key
  const newKey = await generateDataKey();
  const exported = await exportKey(newKey);
  localStorage.setItem(storageKey, exported);

  // Re-import as non-extractable for security
  cachedDataKey = await importKey(exported);

  console.log('[Encryption] Generated new encryption key for user');
  return cachedDataKey;
}

export function EncryptionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuthSession();
  const [isReady, setIsReady] = useState(false);

  // Initialize encryption key when user is available
  useEffect(() => {
    if (!user?.id) {
      setIsReady(false);
      cachedDataKey = null;
      return;
    }

    const initKey = async () => {
      try {
        await getOrCreateKey(user.id);
        setIsReady(true);
      } catch (err) {
        console.error('[Encryption] Failed to initialize:', err);
        // Encryption is optional - app still works without it
        setIsReady(true);
      }
    };

    initKey();
  }, [user?.id]);

  /**
   * Encrypt plaintext string (required - throws if encryption fails)
   */
  const encryptText = useCallback(async (plaintext: string): Promise<string> => {
    if (!user?.id) {
      throw new Error('Cannot encrypt: User not authenticated');
    }

    const key = await getOrCreateKey(user.id);
    return encrypt(plaintext, key);
  }, [user?.id]);

  /**
   * Decrypt ciphertext string
   * Returns original if not encrypted (for backwards compatibility with pre-encryption messages)
   */
  const decryptText = useCallback(async (ciphertext: string): Promise<string> => {
    if (!user?.id) {
      throw new Error('Cannot decrypt: User not authenticated');
    }

    // If not encrypted, return as-is (backwards compatibility)
    if (!isEncrypted(ciphertext)) {
      return ciphertext;
    }

    const key = await getOrCreateKey(user.id);
    return await decrypt(ciphertext, key);
  }, [user?.id]);

  /**
   * Encrypt a JSON object (required - throws if encryption fails)
   */
  const encryptObject = useCallback(async <T,>(data: T): Promise<string> => {
    if (!user?.id) {
      throw new Error('Cannot encrypt: User not authenticated');
    }

    const key = await getOrCreateKey(user.id);
    return encryptJSON(data, key);
  }, [user?.id]);

  /**
   * Decrypt to a JSON object
   * Returns parsed JSON if not encrypted (for backwards compatibility)
   */
  const decryptObject = useCallback(async <T,>(ciphertext: string): Promise<T> => {
    if (!user?.id) {
      throw new Error('Cannot decrypt: User not authenticated');
    }

    // If not encrypted, return parsed JSON (backwards compatibility)
    if (!isEncrypted(ciphertext)) {
      return JSON.parse(ciphertext);
    }

    const key = await getOrCreateKey(user.id);
    return await decryptJSON<T>(ciphertext, key);
  }, [user?.id]);

  /**
   * Check if data is encrypted
   */
  const isEncryptedData = useCallback((data: string): boolean => {
    return isEncrypted(data);
  }, []);

  return (
    <EncryptionContext.Provider
      value={{
        isReady,
        encryptText,
        decryptText,
        encryptObject,
        decryptObject,
        isEncryptedData,
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

  // If no context, return a safe fallback that indicates encryption isn't available
  if (context === undefined) {
    return {
      isReady: false,
      encryptText: async () => { throw new Error('Encryption not available - EncryptionProvider not found'); },
      decryptText: async () => { throw new Error('Encryption not available - EncryptionProvider not found'); },
      encryptObject: async () => { throw new Error('Encryption not available - EncryptionProvider not found'); },
      decryptObject: async () => { throw new Error('Encryption not available - EncryptionProvider not found'); },
      isEncryptedData: () => false,
    };
  }

  return context;
}
