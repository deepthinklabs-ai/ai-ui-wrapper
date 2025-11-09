/**
 * Revert With Draft Undo Hook
 *
 * Manages undo functionality for the revert+draft feature.
 * Captures deleted messages, draft content, and allows full restoration.
 */

"use client";

import { useState, useCallback } from "react";
import { restoreMessages } from "@/lib/messageOperations";
import type { Message } from "@/types/chat";
import type { AIModel } from "@/lib/apiKeyStorage";

type UndoState = {
  deletedMessages: Omit<Message, "id">[];
  originalModel: AIModel | null;
  previousDraft: string;
  timestamp: number;
} | null;

type UseRevertWithDraftUndoOptions = {
  onModelChange?: (model: AIModel) => void;
  onDraftChange?: (draft: string) => void;
  refreshMessages: () => Promise<void>;
};

type UseRevertWithDraftUndoResult = {
  canUndo: boolean;
  undoInFlight: boolean;
  captureRevertWithDraftState: (
    deletedMessages: Message[],
    originalModel: AIModel | null,
    previousDraft: string
  ) => void;
  handleUndo: () => Promise<void>;
  clearUndoState: () => void;
};

const UNDO_TIMEOUT_MS = 30000; // 30 seconds

export function useRevertWithDraftUndo(
  options: UseRevertWithDraftUndoOptions
): UseRevertWithDraftUndoResult {
  const { onModelChange, onDraftChange, refreshMessages } = options;
  const [undoState, setUndoState] = useState<UndoState>(null);
  const [undoInFlight, setUndoInFlight] = useState(false);

  /**
   * Capture the state before a revert+draft operation
   * This allows us to undo the revert and restore the draft later
   */
  const captureRevertWithDraftState = useCallback(
    (deletedMessages: Message[], originalModel: AIModel | null, previousDraft: string) => {
      console.log('Revert+Draft Undo: Capturing state', {
        deletedCount: deletedMessages.length,
        originalModel,
        hadPreviousDraft: previousDraft.length > 0,
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
        previousDraft,
        timestamp: Date.now(),
      });

      // Auto-clear undo state after timeout
      setTimeout(() => {
        setUndoState((current) => {
          if (current && Date.now() - current.timestamp >= UNDO_TIMEOUT_MS) {
            console.log('Revert+Draft Undo: Auto-clearing expired undo state');
            return null;
          }
          return current;
        });
      }, UNDO_TIMEOUT_MS);
    },
    []
  );

  /**
   * Undo the last revert+draft operation
   * Restores deleted messages, clears the draft, and switches back to original model
   */
  const handleUndo = useCallback(async () => {
    if (!undoState) {
      console.warn('Revert+Draft Undo: No undo state available');
      return;
    }

    // Check if undo has expired
    if (Date.now() - undoState.timestamp >= UNDO_TIMEOUT_MS) {
      console.warn('Revert+Draft Undo: Undo state has expired');
      setUndoState(null);
      return;
    }

    setUndoInFlight(true);
    try {
      console.log('Revert+Draft Undo: Restoring messages and draft', {
        messageCount: undoState.deletedMessages.length,
        originalModel: undoState.originalModel,
        restoringDraft: undoState.previousDraft.length > 0,
      });

      // Restore the deleted messages
      const result = await restoreMessages(undoState.deletedMessages);

      if (!result.success) {
        throw new Error(result.error || "Failed to restore messages");
      }

      console.log(`Revert+Draft Undo: Successfully restored ${result.restoredCount} messages`);

      // Clear the draft (restore to previous state)
      if (onDraftChange) {
        console.log('Revert+Draft Undo: Clearing draft content');
        onDraftChange(undoState.previousDraft);
      }

      // Switch back to the original model if available
      if (undoState.originalModel && onModelChange) {
        console.log(`Revert+Draft Undo: Switching back to model: ${undoState.originalModel}`);
        onModelChange(undoState.originalModel);
      }

      // Clear undo state
      setUndoState(null);

      // Refresh messages to show restored state
      await refreshMessages();
    } catch (error) {
      console.error("Revert+Draft Undo: Error during undo:", error);
      // Don't clear undo state on error so user can retry
    } finally {
      setUndoInFlight(false);
    }
  }, [undoState, onModelChange, onDraftChange, refreshMessages]);

  /**
   * Manually clear the undo state
   */
  const clearUndoState = useCallback(() => {
    console.log('Revert+Draft Undo: Clearing undo state');
    setUndoState(null);
  }, []);

  return {
    canUndo: undoState !== null && Date.now() - undoState.timestamp < UNDO_TIMEOUT_MS,
    undoInFlight,
    captureRevertWithDraftState,
    handleUndo,
    clearUndoState,
  };
}
