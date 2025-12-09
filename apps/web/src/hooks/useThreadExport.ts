/**
 * useThreadExport Hook
 *
 * Provides functionality for exporting threads as .thread files.
 * Handles loading messages, DECRYPTING them, creating the file, and triggering download.
 *
 * IMPORTANT: Messages are decrypted before export so the .thread file
 * contains plaintext that can be imported by any user.
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useEncryption } from '@/contexts/EncryptionContext';
import {
  createThreadFile,
  serializeThreadFile,
  generateThreadFilename,
  downloadThreadFile,
} from '@/lib/threadFileUtils';
import { validateDecryption, isDecryptionSuccess } from '@/lib/decryptionValidator';
import type { Thread, Message } from '@/types/chat';
import type { ThreadExportOptions } from '@/types/threadFile';

type UseThreadExportResult = {
  /** Export a thread by its ID */
  exportThread: (threadId: string) => Promise<void>;
  /** Export a thread using existing thread and messages data */
  exportThreadWithData: (thread: Thread, messages: Message[]) => Promise<void>;
  /** Whether an export is in progress */
  isExporting: boolean;
  /** Error message if export failed */
  error: string | null;
  /** Clear the error state */
  clearError: () => void;
};

type UseThreadExportOptions = {
  /** User ID for loading threads */
  userId?: string;
  /** Export options */
  exportOptions?: ThreadExportOptions;
  /** Callback when export completes successfully */
  onExportComplete?: (filename: string) => void;
  /** Callback when export fails */
  onExportError?: (error: string) => void;
};

/**
 * Hook for exporting threads as .thread files
 */
export function useThreadExport(options: UseThreadExportOptions = {}): UseThreadExportResult {
  const { userId, exportOptions, onExportComplete, onExportError } = options;

  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Get decryption function from encryption context
  const { decryptText, isReady: isEncryptionReady, state: encryptionState } = useEncryption();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Decrypt a single message content
   */
  const decryptMessageContent = useCallback(async (content: string): Promise<string> => {
    // If encryption isn't set up or not unlocked, return content as-is
    if (!encryptionState.hasEncryption || !encryptionState.isUnlocked) {
      return content;
    }

    const result = await validateDecryption(content, decryptText, { itemType: 'export' });

    if (isDecryptionSuccess(result)) {
      return result.data;
    }

    // If decryption fails, return original (might already be plaintext)
    return content;
  }, [decryptText, encryptionState.hasEncryption, encryptionState.isUnlocked]);

  /**
   * Decrypt all messages for export
   */
  const decryptMessages = useCallback(async (messages: Message[]): Promise<Message[]> => {
    return Promise.all(
      messages.map(async (msg) => ({
        ...msg,
        content: await decryptMessageContent(msg.content),
      }))
    );
  }, [decryptMessageContent]);

  /**
   * Load thread and messages from database, DECRYPT them, then export
   */
  const exportThread = useCallback(async (threadId: string) => {
    if (!userId) {
      const errorMsg = 'User ID is required to export thread';
      setError(errorMsg);
      onExportError?.(errorMsg);
      return;
    }

    // Check if encryption is ready when user has encryption enabled
    if (encryptionState.hasEncryption && !encryptionState.isUnlocked) {
      const errorMsg = 'Please unlock encryption before exporting';
      setError(errorMsg);
      onExportError?.(errorMsg);
      return;
    }

    setIsExporting(true);
    setError(null);

    try {
      // Load thread data
      const { data: thread, error: threadError } = await supabase
        .from('threads')
        .select('*')
        .eq('id', threadId)
        .single();

      if (threadError || !thread) {
        throw new Error('Failed to load thread');
      }

      // Load messages for the thread
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        throw new Error('Failed to load messages');
      }

      // DECRYPT messages before export so the file contains plaintext
      const decryptedMessages = await decryptMessages((messages || []) as Message[]);

      // Create and download the file with decrypted content
      const threadFile = createThreadFile(thread as Thread, decryptedMessages, exportOptions);
      const content = serializeThreadFile(threadFile);
      const filename = generateThreadFilename(thread as Thread);

      downloadThreadFile(content, filename);

      console.log(`[ThreadExport] Exported thread "${thread.title}" with ${messages?.length || 0} messages (decrypted)`);
      onExportComplete?.(filename);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to export thread';
      console.error('[ThreadExport] Export failed:', err);
      setError(errorMsg);
      onExportError?.(errorMsg);
    } finally {
      setIsExporting(false);
    }
  }, [userId, exportOptions, onExportComplete, onExportError, encryptionState.hasEncryption, encryptionState.isUnlocked, decryptMessages]);

  /**
   * Export using already-loaded thread and messages data
   * NOTE: Messages passed here should already be decrypted (from useEncryptedMessages)
   */
  const exportThreadWithData = useCallback(async (thread: Thread, messages: Message[]) => {
    try {
      // Decrypt messages in case they're still encrypted
      const decryptedMessages = await decryptMessages(messages);

      const threadFile = createThreadFile(thread, decryptedMessages, exportOptions);
      const content = serializeThreadFile(threadFile);
      const filename = generateThreadFilename(thread);

      downloadThreadFile(content, filename);

      console.log(`[ThreadExport] Exported thread "${thread.title}" with ${messages.length} messages (decrypted)`);
      onExportComplete?.(filename);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to export thread';
      console.error('[ThreadExport] Export failed:', err);
      setError(errorMsg);
      onExportError?.(errorMsg);
    }
  }, [exportOptions, onExportComplete, onExportError, decryptMessages]);

  return {
    exportThread,
    exportThreadWithData,
    isExporting,
    error,
    clearError,
  };
}
