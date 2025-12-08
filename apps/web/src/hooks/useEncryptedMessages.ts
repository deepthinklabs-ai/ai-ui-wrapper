"use client";

/**
 * useEncryptedMessages Hook
 *
 * A wrapper around useMessages that adds client-side encryption.
 * - Encrypts message content before storing to database
 * - Decrypts message content when loading from database
 * - Sends PLAINTEXT to AI (so AI can understand the message)
 * - Stores ENCRYPTED content in database (so server can't read it)
 *
 * Uses structured error handling and circuit breaker for resilience.
 */

import { useEffect, useState, useCallback } from "react";
import { useEncryption } from "@/contexts/EncryptionContext";
import { useMessages } from "./useMessages";
import type { Message } from "@/types/chat";
import {
  validateDecryption,
  isDecryptionSuccess,
  type DecryptionResult,
} from "@/lib/decryptionValidator";
import {
  getCircuitBreaker,
  type CircuitBreakerState,
} from "@/lib/decryptionCircuitBreaker";
import { EncryptionError, isEncryptionError } from "@/lib/encryptionErrors";

type UseEncryptedMessagesOptions = {
  onThreadTitleUpdated?: () => void;
  systemPromptAddition?: string;
  userTier?: 'trial' | 'pro' | 'expired';
  userId?: string;
  enableWebSearch?: boolean;
  disableMCPTools?: boolean;
  gmailTools?: any;
};

type DecryptionStats = {
  total: number;
  successful: number;
  plaintext: number;
  failed: number;
};

type UseEncryptedMessagesResult = {
  messages: Message[];
  loadingMessages: boolean;
  messagesError: string | null;
  encryptionError: string | null;
  encryptionErrorCode: string | null;
  decryptionStats: DecryptionStats | null;
  isCircuitBreakerOpen: boolean;
  sendInFlight: boolean;
  summarizeInFlight: boolean;
  isEncryptionReady: boolean;
  needsEncryptionSetup: boolean;
  needsEncryptionUnlock: boolean;
  sendMessage: (content: string, files?: File[], overrideThreadId?: string) => Promise<void>;
  summarizeThread: () => Promise<void>;
  generateSummary: () => Promise<string>;
  refreshMessages: () => Promise<void>;
  resetCircuitBreaker: () => void;
};

export function useEncryptedMessages(
  threadId: string | null,
  options?: UseEncryptedMessagesOptions
): UseEncryptedMessagesResult {
  const [decryptedMessages, setDecryptedMessages] = useState<Message[]>([]);
  const [encryptionError, setEncryptionError] = useState<string | null>(null);
  const [encryptionErrorCode, setEncryptionErrorCode] = useState<string | null>(null);
  const [decryptionStats, setDecryptionStats] = useState<DecryptionStats | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isCircuitBreakerOpen, setIsCircuitBreakerOpen] = useState(false);

  // Get circuit breaker for messages
  const circuitBreaker = getCircuitBreaker('messages');

  // Get encryption functions
  const {
    encryptText,
    decryptText,
    isReady: isEncryptionReady,
    state: encryptionState,
  } = useEncryption();

  // Determine encryption status
  const needsEncryptionSetup = !encryptionState.isLoading && !encryptionState.hasEncryption;
  const needsEncryptionUnlock = !encryptionState.isLoading && encryptionState.hasEncryption && !encryptionState.isUnlocked;

  // Subscribe to circuit breaker state changes
  useEffect(() => {
    const unsubscribe = circuitBreaker.subscribe((state: CircuitBreakerState) => {
      setIsCircuitBreakerOpen(state.isOpen);
      if (state.isOpen && state.lastError) {
        setEncryptionError(state.lastError.getUserMessage());
        setEncryptionErrorCode(state.lastError.code);
      }
    });
    return unsubscribe;
  }, [circuitBreaker]);

  // Pass encryption function to useMessages for database storage
  // The AI will receive plaintext, but the database will store encrypted
  const baseMessages = useMessages(threadId, {
    ...options,
    encryptForStorage: isEncryptionReady && encryptionState.isUnlocked ? encryptText : undefined,
  });

  /**
   * Decrypt a single message with validation
   */
  const decryptMessage = useCallback(async (msg: Message): Promise<{
    message: Message;
    result: DecryptionResult<string>;
  }> => {
    // Check circuit breaker first
    if (circuitBreaker.isCircuitOpen()) {
      return {
        message: msg,
        result: {
          status: 'error',
          error: new EncryptionError('RATE_LIMITED', 'Decryption temporarily disabled'),
        },
      };
    }

    const result = await validateDecryption(
      msg.content,
      decryptText,
      { itemId: msg.id, itemType: 'message' }
    );

    if (isDecryptionSuccess(result)) {
      circuitBreaker.recordSuccess();
      return {
        message: { ...msg, content: result.data },
        result,
      };
    }

    // Record failure in circuit breaker (except for LOCKED errors)
    if (result.error.code !== 'LOCKED') {
      circuitBreaker.recordFailure(result.error);
    }

    // Log the specific error type
    console.warn(
      `[Encryption] Decryption ${result.status} for message ${msg.id}:`,
      result.error.code,
      result.error.message
    );

    // Return original message on failure
    return { message: msg, result };
  }, [decryptText, circuitBreaker]);

  /**
   * Reset the circuit breaker manually
   */
  const resetCircuitBreaker = useCallback(() => {
    circuitBreaker.reset();
    setIsCircuitBreakerOpen(false);
    setEncryptionError(null);
    setEncryptionErrorCode(null);
  }, [circuitBreaker]);

  /**
   * Decrypt all messages when base messages change
   */
  useEffect(() => {
    // Don't try to decrypt if encryption isn't unlocked
    if (!isEncryptionReady || baseMessages.loadingMessages) {
      return;
    }

    // If encryption isn't set up, just use the messages as-is
    if (!encryptionState.hasEncryption) {
      setDecryptedMessages(baseMessages.messages);
      setDecryptionStats(null);
      return;
    }

    // If encryption is set up but not unlocked, show empty messages
    if (!encryptionState.isUnlocked) {
      setDecryptedMessages([]);
      setDecryptionStats(null);
      return;
    }

    const decryptAll = async () => {
      if (baseMessages.messages.length === 0) {
        setDecryptedMessages([]);
        setDecryptionStats({ total: 0, successful: 0, plaintext: 0, failed: 0 });
        return;
      }

      setIsDecrypting(true);
      setEncryptionError(null);
      setEncryptionErrorCode(null);

      try {
        const results = await Promise.all(
          baseMessages.messages.map(decryptMessage)
        );

        // Calculate stats
        const stats: DecryptionStats = {
          total: results.length,
          successful: results.filter(r => r.result.status === 'success').length,
          plaintext: results.filter(r => r.result.status === 'plaintext').length,
          failed: results.filter(r => !isDecryptionSuccess(r.result)).length,
        };
        setDecryptionStats(stats);

        // Extract messages
        const messages = results.map(r => r.message);
        setDecryptedMessages(messages);

        // Set error if any failures (excluding plaintext)
        const firstError = results.find(r => !isDecryptionSuccess(r.result));
        if (firstError && 'error' in firstError.result) {
          const error = firstError.result.error;
          setEncryptionError(error.getUserMessage());
          setEncryptionErrorCode(error.code);
        }
      } catch (err) {
        console.error('[Encryption] Failed to decrypt messages:', err);
        const error = isEncryptionError(err)
          ? err
          : new EncryptionError('UNKNOWN', 'Failed to decrypt messages');
        setEncryptionError(error.getUserMessage());
        setEncryptionErrorCode(error.code);
        setDecryptedMessages(baseMessages.messages);
      } finally {
        setIsDecrypting(false);
      }
    };

    decryptAll();
  }, [
    baseMessages.messages,
    baseMessages.loadingMessages,
    isEncryptionReady,
    encryptionState.hasEncryption,
    encryptionState.isUnlocked,
    decryptMessage
  ]);

  return {
    messages: decryptedMessages,
    loadingMessages: baseMessages.loadingMessages || isDecrypting || encryptionState.isLoading,
    messagesError: baseMessages.messagesError,
    encryptionError,
    encryptionErrorCode,
    decryptionStats,
    isCircuitBreakerOpen,
    sendInFlight: baseMessages.sendInFlight,
    summarizeInFlight: baseMessages.summarizeInFlight,
    isEncryptionReady,
    needsEncryptionSetup,
    needsEncryptionUnlock,
    sendMessage: baseMessages.sendMessage,
    summarizeThread: baseMessages.summarizeThread,
    generateSummary: baseMessages.generateSummary,
    refreshMessages: baseMessages.refreshMessages,
    resetCircuitBreaker,
  };
}
