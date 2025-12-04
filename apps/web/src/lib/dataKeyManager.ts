/**
 * Data Key Manager
 *
 * Centralized service for managing the encryption data key lifecycle.
 * Decouples key management from React context to prevent issues with
 * component remounts and provide a cleaner API.
 *
 * Features:
 * - In-memory key storage with sessionStorage persistence
 * - Subscription pattern for state changes
 * - Clear lifecycle management
 * - Thread-safe operations
 */

import { EncryptionError } from './encryptionErrors';

const SESSION_KEY_STORAGE = 'encryption_session_key';

type KeyState =
  | { status: 'empty' }
  | { status: 'loading' }
  | { status: 'loaded'; key: CryptoKey; loadedAt: Date }
  | { status: 'error'; error: EncryptionError };

type KeyStateListener = (state: KeyState) => void;

class DataKeyManager {
  private state: KeyState = { status: 'empty' };
  private listeners: Set<KeyStateListener> = new Set();
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Attempt to restore from session on construction
    this.initPromise = this.restoreFromSession();
  }

  /**
   * Get the current state
   */
  getState(): Readonly<KeyState> {
    return this.state;
  }

  /**
   * Check if a key is currently available
   */
  hasKey(): boolean {
    return this.state.status === 'loaded';
  }

  /**
   * Get the current key (throws if not available)
   */
  getKey(): CryptoKey {
    if (this.state.status !== 'loaded') {
      throw new EncryptionError('LOCKED', 'Encryption key not available');
    }
    return this.state.key;
  }

  /**
   * Get the current key or null if not available
   */
  getKeyOrNull(): CryptoKey | null {
    return this.state.status === 'loaded' ? this.state.key : null;
  }

  /**
   * Set the data key (after successful unlock)
   */
  async setKey(key: CryptoKey): Promise<void> {
    try {
      // Persist to session storage
      await this.saveToSession(key);

      this.setState({
        status: 'loaded',
        key,
        loadedAt: new Date(),
      });
    } catch (err) {
      const error = new EncryptionError('EXPORT_FAILED', 'Failed to save encryption key', {
        originalError: err instanceof Error ? err : undefined,
      });
      this.setState({ status: 'error', error });
      throw error;
    }
  }

  /**
   * Clear the data key (on logout or manual lock)
   */
  clearKey(): void {
    this.clearFromSession();
    this.setState({ status: 'empty' });
  }

  /**
   * Wait for initial restoration to complete
   */
  async waitForInit(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: KeyStateListener): () => void {
    this.listeners.add(listener);
    // Immediately notify with current state
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /**
   * Attempt to restore key from session storage
   */
  private async restoreFromSession(): Promise<void> {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY_STORAGE);
      if (!stored) {
        return;
      }

      this.setState({ status: 'loading' });

      const jwk = JSON.parse(stored);
      const key = await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'AES-GCM', length: 256 },
        false, // Not extractable after import (more secure)
        ['encrypt', 'decrypt']
      );

      this.setState({
        status: 'loaded',
        key,
        loadedAt: new Date(),
      });
    } catch (err) {
      console.error('[DataKeyManager] Failed to restore key from session:', err);
      // Clear corrupted data
      this.clearFromSession();
      this.setState({ status: 'empty' });
    }
  }

  /**
   * Save key to session storage
   */
  private async saveToSession(key: CryptoKey): Promise<void> {
    try {
      // Export key as JWK (JSON Web Key)
      const jwk = await crypto.subtle.exportKey('jwk', key);
      sessionStorage.setItem(SESSION_KEY_STORAGE, JSON.stringify(jwk));
    } catch (err) {
      console.error('[DataKeyManager] Failed to save key to session:', err);
      throw err;
    }
  }

  /**
   * Clear key from session storage
   */
  private clearFromSession(): void {
    try {
      sessionStorage.removeItem(SESSION_KEY_STORAGE);
    } catch (err) {
      console.error('[DataKeyManager] Failed to clear key from session:', err);
    }
  }

  /**
   * Update state and notify listeners
   */
  private setState(newState: KeyState): void {
    this.state = newState;
    this.notifyListeners();
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const state = this.state;
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (err) {
        console.error('[DataKeyManager] Listener error:', err);
      }
    });
  }
}

// Singleton instance
let instance: DataKeyManager | null = null;

/**
 * Get the singleton DataKeyManager instance
 */
export function getDataKeyManager(): DataKeyManager {
  if (!instance) {
    instance = new DataKeyManager();
  }
  return instance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetDataKeyManager(): void {
  if (instance) {
    instance.clearKey();
  }
  instance = null;
}

export { DataKeyManager };
export type { KeyState, KeyStateListener };
