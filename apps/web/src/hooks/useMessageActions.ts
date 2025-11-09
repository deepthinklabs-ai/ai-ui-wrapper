/**
 * Message Actions Hook
 *
 * Handles message-level operations like reverting to a point in conversation
 * or forking from a specific message. Provides version control for threads.
 */

"use client";

import { useState } from "react";
import { deleteMessages } from "@/lib/messageOperations";
import { useRevertUndo } from "@/hooks/useRevertUndo";
import type { Message } from "@/types/chat";
import type { AIModel } from "@/lib/apiKeyStorage";

type UseMessageActionsOptions = {
  threadId: string | null;
  currentThreadTitle: string | null;
  messages: Message[];
  refreshMessages: () => Promise<void>;
  forkThread: (threadId: string, messages: { role: string; content: string; model: string | null }[]) => Promise<string | null>;
  refreshThreads: () => Promise<void>;
  onModelChange?: (model: AIModel) => void;
  currentModel?: AIModel;
};

type UseMessageActionsResult = {
  revertInFlight: boolean;
  forkFromMessageInFlight: boolean;
  handleRevertToMessage: (messageId: string, switchToOriginalModel?: boolean) => Promise<void>;
  handleForkFromMessage: (messageId: string) => Promise<void>;
  // Undo functionality
  canUndoRevert: boolean;
  undoRevertInFlight: boolean;
  handleUndoRevert: () => Promise<void>;
};

export function useMessageActions(options: UseMessageActionsOptions): UseMessageActionsResult {
  const {
    threadId,
    currentThreadTitle,
    messages,
    refreshMessages,
    forkThread,
    refreshThreads,
    onModelChange,
    currentModel,
  } = options;

  const [revertInFlight, setRevertInFlight] = useState(false);
  const [forkFromMessageInFlight, setForkFromMessageInFlight] = useState(false);

  // Undo functionality for revert operations
  const {
    canUndo: canUndoRevert,
    undoInFlight: undoRevertInFlight,
    captureRevertState,
    handleUndo: handleUndoRevert,
  } = useRevertUndo({
    onModelChange,
    refreshMessages,
  });

  /**
   * Revert thread to a specific message by deleting all messages after it
   * @param messageId - The ID of the message to revert to
   * @param switchToOriginalModel - If true, switch to the model used at that message
   */
  const handleRevertToMessage = async (messageId: string, switchToOriginalModel = false) => {
    if (!threadId) return;

    // Find the index of the target message
    const targetIndex = messages.findIndex(m => m.id === messageId);
    if (targetIndex === -1) return;

    const targetMessage = messages[targetIndex];

    // Get all messages that come after this one
    const messagesToDelete = messages.slice(targetIndex + 1);

    console.log('Revert Debug:', {
      totalMessages: messages.length,
      targetIndex,
      targetMessageId: messageId,
      messagesToDeleteCount: messagesToDelete.length,
      messagesToDeleteIds: messagesToDelete.map(m => ({ id: m.id, role: m.role, content: m.content.substring(0, 50) }))
    });

    if (messagesToDelete.length === 0) {
      console.log("No messages to delete - already at the end");
      return;
    }

    setRevertInFlight(true);
    try {
      // Capture state for undo BEFORE deleting
      captureRevertState(messagesToDelete, currentModel || null);

      // Delete all messages after the target message
      const messageIdsToDelete = messagesToDelete.map(m => m.id);

      const result = await deleteMessages(messageIdsToDelete);

      if (!result.success) {
        throw new Error(result.error || "Failed to delete messages");
      }

      console.log(`Reverted thread to message ${messageId}, deleted ${result.deletedCount} messages`);

      // Switch to original model if requested and available
      if (switchToOriginalModel && targetMessage.model && onModelChange) {
        console.log(`Switching to original model: ${targetMessage.model}`);
        onModelChange(targetMessage.model as AIModel);
      }

      // Refresh messages to show updated state
      await refreshMessages();
    } catch (error) {
      console.error("Error reverting to message:", error);
    } finally {
      setRevertInFlight(false);
    }
  };

  /**
   * Fork thread from a specific message by creating a new thread with messages up to that point
   */
  const handleForkFromMessage = async (messageId: string) => {
    if (!threadId) return;

    // Find the index of the target message
    const targetIndex = messages.findIndex(m => m.id === messageId);
    if (targetIndex === -1) return;

    // Get all messages up to and including the target message
    const messagesToCopy = messages.slice(0, targetIndex + 1);

    setForkFromMessageInFlight(true);
    try {
      // Create a new thread with these messages
      const newThreadId = await forkThread(
        threadId,
        messagesToCopy.map(m => ({
          role: m.role,
          content: m.content,
          model: m.model,
        }))
      );

      if (newThreadId) {
        await refreshThreads();
        console.log(`Forked thread from message ${messageId} into new thread ${newThreadId}`);
      }
    } catch (error) {
      console.error("Error forking from message:", error);
    } finally {
      setForkFromMessageInFlight(false);
    }
  };

  return {
    revertInFlight,
    forkFromMessageInFlight,
    handleRevertToMessage,
    handleForkFromMessage,
    canUndoRevert,
    undoRevertInFlight,
    handleUndoRevert,
  };
}
