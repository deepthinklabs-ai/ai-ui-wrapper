/**
 * Revert Undo Hook
 *
 * Manages undo functionality for the standard revert feature.
 * Captures deleted messages and allows restoring them with the original model.
 */

"use client";

import { useState, useCallback } from "react";
import { restoreMessages } from "@/lib/messageOperations";
import type { Message } from "@/types/chat";
import type { AIModel } from "@/lib/apiKeyStorage";

type UndoState = {
  deletedMessages: Omit<Message, "id">[];
  originalModel: AIModel | null;
  timestamp: number;
} | null;

type UseRevertUndoOptions = {
  onModelChange?: (model: AIModel) => void;
  refreshMessages: () => Promise<void>;
};

type UseRevertUndoResult = {
  canUndo: boolean;
  undoInFlight: boolean;
  captureRevertState: (deletedMessages: Message[], originalModel: AIModel | null) => void;
  handleUndo: () => Promise<void>;
  clearUndoState: () => void;
};

const UNDO_TIMEOUT_MS = 30000; // 30 seconds

export function useRevertUndo(options: UseRevertUndoOptions): UseRevertUndoResult {
  const { onModelChange, refreshMessages } = options;
  const [undoState, setUndoState] = useState<UndoState>(null);
  const [undoInFlight, setUndoInFlight] = useState(false);

  /**
   * Capture the state before a revert operation
   * This allows us to undo the revert later
   */
  const captureRevertState = useCallback((deletedMessages: Message[], originalModel: AIModel | null) => {
    console.log('Revert Undo: Capturing state', {
      deletedCount: deletedMessages.length,
      originalModel,
    });

    // Store messages without IDs (they'll get new IDs when restored)
    // Include attachments so they can be restored
    const messagesToStore = deletedMessages.map(msg => ({
      thread_id: msg.thread_id,
      role: msg.role,
      content: msg.content,
      model: msg.model,
      attachments: msg.attachments,
      created_at: msg.created_at,
    }));

    setUndoState({
      deletedMessages: messagesToStore,
      originalModel,
      timestamp: Date.now(),
    });

    // Auto-clear undo state after timeout
    setTimeout(() => {
      setUndoState((current) => {
        if (current && Date.now() - current.timestamp >= UNDO_TIMEOUT_MS) {
          console.log('Revert Undo: Auto-clearing expired undo state');
          return null;
        }
        return current;
      });
    }, UNDO_TIMEOUT_MS);
  }, []);

  /**
   * Undo the last revert operation
   * Restores deleted messages and switches back to original model
   */
  const handleUndo = useCallback(async () => {
    if (!undoState) {
      console.warn('Revert Undo: No undo state available');
      return;
    }

    // Check if undo has expired
    if (Date.now() - undoState.timestamp >= UNDO_TIMEOUT_MS) {
      console.warn('Revert Undo: Undo state has expired');
      setUndoState(null);
      return;
    }

    setUndoInFlight(true);
    try {
      console.log('Revert Undo: Restoring messages', {
        messageCount: undoState.deletedMessages.length,
        originalModel: undoState.originalModel,
      });

      // Restore the deleted messages
      const result = await restoreMessages(undoState.deletedMessages);

      if (!result.success) {
        throw new Error(result.error || "Failed to restore messages");
      }

      console.log(`Revert Undo: Successfully restored ${result.restoredCount} messages`);

      // Switch back to the original model if available
      if (undoState.originalModel && onModelChange) {
        console.log(`Revert Undo: Switching back to model: ${undoState.originalModel}`);
        onModelChange(undoState.originalModel);
      }

      // Clear undo state
      setUndoState(null);

      // Refresh messages to show restored state
      await refreshMessages();
    } catch (error) {
      console.error("Revert Undo: Error during undo:", error);
      // Don't clear undo state on error so user can retry
    } finally {
      setUndoInFlight(false);
    }
  }, [undoState, onModelChange, refreshMessages]);

  /**
   * Manually clear the undo state
   */
  const clearUndoState = useCallback(() => {
    console.log('Revert Undo: Clearing undo state');
    setUndoState(null);
  }, []);

  return {
    canUndo: undoState !== null && Date.now() - undoState.timestamp < UNDO_TIMEOUT_MS,
    undoInFlight,
    captureRevertState,
    handleUndo,
    clearUndoState,
  };
}
