/**
 * useThreadImport Hook
 *
 * Provides functionality for importing .thread files.
 * Creates a new thread with the imported messages.
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { readThreadFile } from '@/lib/threadFileUtils';
import type { ThreadFile, ThreadImportResult } from '@/types/threadFile';
import { THREAD_FILE_EXTENSION } from '@/types/threadFile';

type UseThreadImportResult = {
  /** Import a thread from a File object */
  importThread: (file: File) => Promise<ThreadImportResult>;
  /** Open file picker and import selected file */
  openFilePicker: () => void;
  /** Whether an import is in progress */
  isImporting: boolean;
  /** Error message if import failed */
  error: string | null;
  /** Clear the error state */
  clearError: () => void;
  /** Reference to hidden file input for custom UI */
  fileInputRef: React.RefObject<HTMLInputElement | null>;
};

type UseThreadImportOptions = {
  /** User ID for creating the thread */
  userId: string;
  /** Folder ID to place the imported thread (optional, uses default folder) */
  folderId?: string | null;
  /** Callback when import completes successfully */
  onImportComplete?: (result: ThreadImportResult) => void;
  /** Callback when import fails */
  onImportError?: (error: string) => void;
  /** Callback to refresh the threads list after import */
  refreshThreads?: () => Promise<void>;
  /** Callback to select the newly imported thread */
  selectThread?: (threadId: string) => void;
};

/**
 * Hook for importing .thread files
 */
export function useThreadImport(options: UseThreadImportOptions): UseThreadImportResult {
  const {
    userId,
    folderId,
    onImportComplete,
    onImportError,
    refreshThreads,
    selectThread,
  } = options;

  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Create thread and messages in database from ThreadFile data
   */
  const createThreadFromFile = useCallback(async (
    threadFile: ThreadFile
  ): Promise<ThreadImportResult> => {
    // Generate a title with (Imported) suffix
    const title = threadFile.metadata.title
      ? `${threadFile.metadata.title} (Imported)`
      : 'Imported Thread';

    // Get default folder if no folder specified
    let targetFolderId = folderId;
    if (!targetFolderId) {
      const { data: defaultFolder } = await supabase
        .from('folders')
        .select('id')
        .eq('user_id', userId)
        .eq('is_default', true)
        .single();

      targetFolderId = defaultFolder?.id || null;
    }

    // Create the thread
    const { data: newThread, error: threadError } = await supabase
      .from('threads')
      .insert({
        user_id: userId,
        title,
        folder_id: targetFolderId,
        position: 0, // Will be at top
      })
      .select()
      .single();

    if (threadError || !newThread) {
      throw new Error('Failed to create thread');
    }

    // Prepare messages for insertion
    // Only include basic fields that are always present - let DB generate timestamps
    const messagesToInsert = threadFile.messages.map((msg) => {
      // Build the message object with only fields that have values
      const messageData: Record<string, any> = {
        thread_id: newThread.id,
        role: msg.role,
        content: msg.content,
        model: msg.model || null,
      };

      // Only add optional fields if they have valid values
      if (msg.attachments && msg.attachments.length > 0) {
        messageData.attachments = msg.attachments;
      }
      if (msg.input_tokens != null) {
        messageData.input_tokens = msg.input_tokens;
      }
      if (msg.output_tokens != null) {
        messageData.output_tokens = msg.output_tokens;
      }
      if (msg.total_tokens != null) {
        messageData.total_tokens = msg.total_tokens;
      }
      if (msg.tool_calls && msg.tool_calls.length > 0) {
        messageData.tool_calls = msg.tool_calls;
      }
      if (msg.tool_results && msg.tool_results.length > 0) {
        messageData.tool_results = msg.tool_results;
      }
      if (msg.citations && msg.citations.length > 0) {
        messageData.citations = msg.citations;
      }

      return messageData;
    });

    // Insert all messages
    if (messagesToInsert.length > 0) {
      const { error: messagesError } = await supabase
        .from('messages')
        .insert(messagesToInsert);

      if (messagesError) {
        console.error('[ThreadImport] Messages insert error:', messagesError);
        // Clean up the thread if messages failed
        await supabase.from('threads').delete().eq('id', newThread.id);
        throw new Error(`Failed to import messages: ${messagesError.message}`);
      }
    }

    return {
      success: true,
      threadId: newThread.id,
      messageCount: messagesToInsert.length,
    };
  }, [userId, folderId]);

  /**
   * Import a thread from a File object
   */
  const importThread = useCallback(async (file: File): Promise<ThreadImportResult> => {
    // Validate file extension
    if (!file.name.endsWith(THREAD_FILE_EXTENSION)) {
      const errorMsg = `Invalid file type. Please select a ${THREAD_FILE_EXTENSION} file`;
      setError(errorMsg);
      onImportError?.(errorMsg);
      return { success: false, error: errorMsg };
    }

    setIsImporting(true);
    setError(null);

    try {
      // Parse and validate the file
      const validation = await readThreadFile(file);

      if (!validation.valid || !validation.data) {
        throw new Error(validation.error || 'Invalid thread file');
      }

      // Create the thread and messages
      const result = await createThreadFromFile(validation.data);

      console.log(`[ThreadImport] Imported thread with ${result.messageCount} messages`);

      // Refresh threads list
      if (refreshThreads) {
        await refreshThreads();
      }

      // Select the new thread
      if (selectThread && result.threadId) {
        selectThread(result.threadId);
      }

      onImportComplete?.(result);
      return result;
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to import thread';
      console.error('[ThreadImport] Import failed:', err);
      setError(errorMsg);
      onImportError?.(errorMsg);
      return { success: false, error: errorMsg };
    } finally {
      setIsImporting(false);
    }
  }, [createThreadFromFile, refreshThreads, selectThread, onImportComplete, onImportError]);

  /**
   * Open the file picker dialog
   */
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return {
    importThread,
    openFilePicker,
    isImporting,
    error,
    clearError,
    fileInputRef,
  };
}
