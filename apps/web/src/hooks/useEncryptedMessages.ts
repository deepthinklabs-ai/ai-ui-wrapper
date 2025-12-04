"use client";

/**
 * useEncryptedMessages Hook
 *
 * A wrapper around useMessages that adds client-side encryption.
 * - Encrypts message content before storing to database
 * - Decrypts message content when loading from database
 * - Sends PLAINTEXT to AI (so AI can understand the message)
 * - Stores ENCRYPTED content in database (so server can't read it)
 */

import { useEffect, useState, useCallback } from "react";
import { useEncryption } from "@/contexts/EncryptionContext";
import { useMessages } from "./useMessages";
import type { Message } from "@/types/chat";

type UseEncryptedMessagesOptions = {
  onThreadTitleUpdated?: () => void;
  systemPromptAddition?: string;
  userTier?: 'free' | 'pro';
  userId?: string;
  enableWebSearch?: boolean;
  disableMCPTools?: boolean;
  gmailTools?: any;
};

type UseEncryptedMessagesResult = {
  messages: Message[];
  loadingMessages: boolean;
  messagesError: string | null;
  encryptionError: string | null;
  sendInFlight: boolean;
  summarizeInFlight: boolean;
  isEncryptionReady: boolean;
  sendMessage: (content: string, files?: File[], overrideThreadId?: string) => Promise<void>;
  summarizeThread: () => Promise<void>;
  generateSummary: () => Promise<string>;
  refreshMessages: () => Promise<void>;
};

export function useEncryptedMessages(
  threadId: string | null,
  options?: UseEncryptedMessagesOptions
): UseEncryptedMessagesResult {
  const [decryptedMessages, setDecryptedMessages] = useState<Message[]>([]);
  const [encryptionError, setEncryptionError] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);

  // Get encryption functions
  const { encryptText, decryptText, isReady: isEncryptionReady } = useEncryption();

  // Pass encryption function to useMessages for database storage
  // The AI will receive plaintext, but the database will store encrypted
  const baseMessages = useMessages(threadId, {
    ...options,
    encryptForStorage: isEncryptionReady ? encryptText : undefined,
  });

  /**
   * Decrypt a single message
   */
  const decryptMessage = useCallback(async (msg: Message): Promise<Message> => {
    try {
      const decryptedContent = await decryptText(msg.content);
      return { ...msg, content: decryptedContent };
    } catch (err) {
      // If decryption fails, might be plaintext (pre-encryption message)
      console.warn('[Encryption] Decryption failed for message, may be plaintext:', msg.id);
      return msg;
    }
  }, [decryptText]);

  /**
   * Decrypt all messages when base messages change
   */
  useEffect(() => {
    if (!isEncryptionReady || baseMessages.loadingMessages) {
      return;
    }

    const decryptAll = async () => {
      if (baseMessages.messages.length === 0) {
        setDecryptedMessages([]);
        return;
      }

      setIsDecrypting(true);
      setEncryptionError(null);

      try {
        const decrypted = await Promise.all(
          baseMessages.messages.map(decryptMessage)
        );
        setDecryptedMessages(decrypted);
      } catch (err: any) {
        console.error('[Encryption] Failed to decrypt messages:', err);
        setEncryptionError('Failed to decrypt messages. Your encryption key may have changed.');
        setDecryptedMessages(baseMessages.messages);
      } finally {
        setIsDecrypting(false);
      }
    };

    decryptAll();
  }, [baseMessages.messages, baseMessages.loadingMessages, isEncryptionReady, decryptMessage]);

  return {
    messages: decryptedMessages,
    loadingMessages: baseMessages.loadingMessages || isDecrypting,
    messagesError: baseMessages.messagesError,
    encryptionError,
    sendInFlight: baseMessages.sendInFlight,
    summarizeInFlight: baseMessages.summarizeInFlight,
    isEncryptionReady,
    sendMessage: baseMessages.sendMessage,
    summarizeThread: baseMessages.summarizeThread,
    generateSummary: baseMessages.generateSummary,
    refreshMessages: baseMessages.refreshMessages,
  };
}
