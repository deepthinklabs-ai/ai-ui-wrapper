/**
 * Encryption State Machine
 *
 * Provides explicit state transitions for the encryption lifecycle,
 * replacing scattered boolean flags with clear, typed states.
 *
 * States:
 * - uninitialized: Initial state before checking server
 * - checking: Fetching encryption status from server
 * - no_encryption: User hasn't set up encryption
 * - locked: Encryption set up but key not unlocked
 * - unlocking: Currently attempting to unlock
 * - unlocked: Key is available for use
 * - error: An error occurred
 */

import { EncryptionError, EncryptionErrorCode } from './encryptionErrors';
import type { EncryptionKeyBundle, RecoveryCodeBundle } from './encryption';

/**
 * Encryption state types
 */
export type EncryptionState =
  | { type: 'uninitialized' }
  | { type: 'checking' }
  | { type: 'no_encryption' }
  | { type: 'locked'; keyBundle: EncryptionKeyBundle; recoveryBundle: RecoveryCodeBundle | null; remainingRecoveryCodes: number }
  | { type: 'unlocking' }
  | { type: 'unlocked'; unlockedAt: Date; remainingRecoveryCodes: number }
  | { type: 'error'; code: EncryptionErrorCode; message: string; previousState: EncryptionState };

/**
 * Actions that can transition state
 */
export type EncryptionAction =
  | { type: 'START_CHECK' }
  | { type: 'CHECK_COMPLETE'; hasEncryption: boolean; keyBundle?: EncryptionKeyBundle; recoveryBundle?: RecoveryCodeBundle; remainingRecoveryCodes?: number }
  | { type: 'CHECK_FAILED'; error: EncryptionError }
  | { type: 'START_UNLOCK' }
  | { type: 'UNLOCK_SUCCESS'; remainingRecoveryCodes: number }
  | { type: 'UNLOCK_FAILED'; error: EncryptionError }
  | { type: 'LOCK' }
  | { type: 'SETUP_COMPLETE'; keyBundle: EncryptionKeyBundle; recoveryBundle: RecoveryCodeBundle }
  | { type: 'RESET' }
  | { type: 'CLEAR_ERROR' };

/**
 * State machine reducer
 */
export function encryptionReducer(state: EncryptionState, action: EncryptionAction): EncryptionState {
  switch (action.type) {
    case 'START_CHECK':
      return { type: 'checking' };

    case 'CHECK_COMPLETE':
      if (!action.hasEncryption) {
        return { type: 'no_encryption' };
      }
      return {
        type: 'locked',
        keyBundle: action.keyBundle!,
        recoveryBundle: action.recoveryBundle || null,
        remainingRecoveryCodes: action.remainingRecoveryCodes || 0,
      };

    case 'CHECK_FAILED':
      return {
        type: 'error',
        code: action.error.code,
        message: action.error.message,
        previousState: state,
      };

    case 'START_UNLOCK':
      if (state.type !== 'locked' && state.type !== 'error') {
        console.warn('[EncryptionStateMachine] Cannot start unlock from state:', state.type);
        return state;
      }
      return { type: 'unlocking' };

    case 'UNLOCK_SUCCESS':
      return {
        type: 'unlocked',
        unlockedAt: new Date(),
        remainingRecoveryCodes: action.remainingRecoveryCodes,
      };

    case 'UNLOCK_FAILED':
      // Return to locked state on failure
      if (state.type === 'unlocking') {
        return {
          type: 'error',
          code: action.error.code,
          message: action.error.message,
          previousState: state,
        };
      }
      return state;

    case 'LOCK':
      if (state.type === 'unlocked') {
        // We don't have the bundles anymore, go back to checking
        return { type: 'checking' };
      }
      return state;

    case 'SETUP_COMPLETE':
      return {
        type: 'unlocked',
        unlockedAt: new Date(),
        remainingRecoveryCodes: action.recoveryBundle.codeHashes.length,
      };

    case 'RESET':
      return { type: 'uninitialized' };

    case 'CLEAR_ERROR':
      if (state.type === 'error') {
        // Return to previous state if available, otherwise go to uninitialized
        const prev = state.previousState;
        if (prev.type === 'unlocking') {
          return { type: 'checking' };
        }
        return prev;
      }
      return state;

    default:
      return state;
  }
}

/**
 * Initial state
 */
export const initialEncryptionState: EncryptionState = { type: 'uninitialized' };

/**
 * Helper functions for state checks
 */
export function isEncryptionReady(state: EncryptionState): boolean {
  return state.type === 'unlocked' || state.type === 'no_encryption';
}

export function isEncryptionLocked(state: EncryptionState): boolean {
  return state.type === 'locked';
}

export function isEncryptionLoading(state: EncryptionState): boolean {
  return state.type === 'checking' || state.type === 'unlocking' || state.type === 'uninitialized';
}

export function hasEncryptionError(state: EncryptionState): boolean {
  return state.type === 'error';
}

export function getEncryptionError(state: EncryptionState): { code: EncryptionErrorCode; message: string } | null {
  if (state.type === 'error') {
    return { code: state.code, message: state.message };
  }
  return null;
}

/**
 * Convert state machine state to legacy format (for backwards compatibility)
 */
export function toLegacyState(state: EncryptionState): {
  isLoading: boolean;
  hasEncryption: boolean;
  isUnlocked: boolean;
  keyBundle: EncryptionKeyBundle | null;
  recoveryBundle: RecoveryCodeBundle | null;
  remainingRecoveryCodes: number;
} {
  switch (state.type) {
    case 'uninitialized':
    case 'checking':
    case 'unlocking':
      return {
        isLoading: true,
        hasEncryption: false,
        isUnlocked: false,
        keyBundle: null,
        recoveryBundle: null,
        remainingRecoveryCodes: 0,
      };

    case 'no_encryption':
      return {
        isLoading: false,
        hasEncryption: false,
        isUnlocked: false,
        keyBundle: null,
        recoveryBundle: null,
        remainingRecoveryCodes: 0,
      };

    case 'locked':
      return {
        isLoading: false,
        hasEncryption: true,
        isUnlocked: false,
        keyBundle: state.keyBundle,
        recoveryBundle: state.recoveryBundle,
        remainingRecoveryCodes: state.remainingRecoveryCodes,
      };

    case 'unlocked':
      return {
        isLoading: false,
        hasEncryption: true,
        isUnlocked: true,
        keyBundle: null, // Key is in DataKeyManager
        recoveryBundle: null,
        remainingRecoveryCodes: state.remainingRecoveryCodes,
      };

    case 'error':
      // On error, show as not loading but preserve previous state info
      const prev = toLegacyState(state.previousState);
      return {
        ...prev,
        isLoading: false,
      };

    default:
      return {
        isLoading: false,
        hasEncryption: false,
        isUnlocked: false,
        keyBundle: null,
        recoveryBundle: null,
        remainingRecoveryCodes: 0,
      };
  }
}
