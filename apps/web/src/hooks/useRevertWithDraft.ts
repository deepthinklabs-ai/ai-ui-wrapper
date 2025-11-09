/**
 * Revert With Draft Hook
 *
 * Handles reverting to a specific message and pre-populating the message composer
 * with the original AI response as a draft. This allows users to regenerate responses
 * with edits or different models while keeping the original response as a starting point.
 */

"use client";

import { useState } from "react";
import { deleteMessages } from "@/lib/messageOperations";
import { useRevertWithDraftUndo } from "@/hooks/useRevertWithDraftUndo";
import type { Message, AttachmentMetadata } from "@/types/chat";
import type { AIModel } from "@/lib/apiKeyStorage";

/**
 * Convert attachment metadata back to File objects
 * This allows us to restore attachments to the composer
 */
function attachmentMetadataToFiles(attachments: AttachmentMetadata[]): File[] {
  return attachments.map(attachment => {
    let blob: Blob;

    if (attachment.isImage) {
      // Convert base64 back to blob for images
      const byteCharacters = atob(attachment.content);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      blob = new Blob([byteArray], { type: attachment.type });
    } else {
      // For text files, create blob from text content
      blob = new Blob([attachment.content], { type: attachment.type });
    }

    // Create File from Blob
    return new File([blob], attachment.name, { type: attachment.type });
  });
}

type UseRevertWithDraftOptions = {
  threadId: string | null;
  messages: Message[];
  refreshMessages: () => Promise<void>;
  onModelChange?: (model: AIModel) => void;
  onDraftChange?: (draft: string) => void;
  onAttachmentsChange?: (files: File[]) => void;
  currentModel?: AIModel;
  currentDraft?: string;
};

type UseRevertWithDraftResult = {
  revertWithDraftInFlight: boolean;
  handleRevertWithDraft: (messageId: string, switchToOriginalModel?: boolean) => Promise<void>;
  // Undo functionality
  canUndoRevertWithDraft: boolean;
  undoRevertWithDraftInFlight: boolean;
  handleUndoRevertWithDraft: () => Promise<void>;
};

export function useRevertWithDraft(options: UseRevertWithDraftOptions): UseRevertWithDraftResult {
  const {
    threadId,
    messages,
    refreshMessages,
    onModelChange,
    onDraftChange,
    onAttachmentsChange,
    currentModel,
    currentDraft,
  } = options;

  const [revertWithDraftInFlight, setRevertWithDraftInFlight] = useState(false);

  // Undo functionality for revert+draft operations
  const {
    canUndo: canUndoRevertWithDraft,
    undoInFlight: undoRevertWithDraftInFlight,
    captureRevertWithDraftState,
    handleUndo: handleUndoRevertWithDraft,
  } = useRevertWithDraftUndo({
    onModelChange,
    onDraftChange,
    refreshMessages,
  });

  /**
   * Delete all messages after an AI response and pre-populate the composer with the next user message
   * Keeps the AI response and everything before it
   * @param messageId - The ID of the AI message (all messages after it will be deleted, first user message used as draft)
   * @param switchToOriginalModel - If true, switch to the model used for that AI response
   */
  const handleRevertWithDraft = async (messageId: string, switchToOriginalModel = false) => {
    if (!threadId) return;

    // Find the index of the target AI message
    const targetIndex = messages.findIndex(m => m.id === messageId);
    if (targetIndex === -1) return;

    const targetMessage = messages[targetIndex];

    // Ensure it's an AI response (assistant role)
    if (targetMessage.role !== "assistant") {
      console.log("Target message is not an AI response");
      return;
    }

    // Get all messages after this AI response
    const messagesAfter = messages.slice(targetIndex + 1);

    console.log('Revert+Draft Debug:', {
      totalMessages: messages.length,
      targetIndex,
      targetMessageId: messageId,
      messagesAfterCount: messagesAfter.length,
      messagesAfterIds: messagesAfter.map(m => ({ id: m.id, role: m.role, content: m.content.substring(0, 50) }))
    });

    if (messagesAfter.length === 0) {
      console.log("No messages after this AI response");
      return;
    }

    // Find the first user message after this AI response to use as draft
    const nextUserMessage = messagesAfter.find(m => m.role === "user");

    if (!nextUserMessage) {
      console.log("No user message found after this AI response");
      return;
    }

    console.log('User message to use as draft:', {
      id: nextUserMessage.id,
      content: nextUserMessage.content.substring(0, 100)
    });

    setRevertWithDraftInFlight(true);
    try {
      // Capture state for undo BEFORE deleting
      captureRevertWithDraftState(messagesAfter, currentModel || null, currentDraft || '');

      // Delete all messages after the target AI response
      const messageIdsToDelete = messagesAfter.map(m => m.id);

      const result = await deleteMessages(messageIdsToDelete);

      if (!result.success) {
        throw new Error(result.error || "Failed to delete messages");
      }

      console.log(`Deleted ${result.deletedCount} messages after AI response ${messageId}`);

      // Pre-populate the composer with the next user message content
      if (onDraftChange) {
        onDraftChange(nextUserMessage.content);
      }

      // Restore attachments if the user message had any
      if (onAttachmentsChange && nextUserMessage.attachments && nextUserMessage.attachments.length > 0) {
        console.log(`Restoring ${nextUserMessage.attachments.length} attachments to composer`);
        const restoredFiles = attachmentMetadataToFiles(nextUserMessage.attachments);
        onAttachmentsChange(restoredFiles);
      } else if (onAttachmentsChange) {
        // Clear attachments if there were none
        onAttachmentsChange([]);
      }

      // Switch to original model if requested and available
      if (switchToOriginalModel && targetMessage.model && onModelChange) {
        console.log(`Switching to original model: ${targetMessage.model}`);
        onModelChange(targetMessage.model as AIModel);
      }

      // Refresh messages to show updated state
      await refreshMessages();
    } catch (error) {
      console.error("Error reverting with draft:", error);
    } finally {
      setRevertWithDraftInFlight(false);
    }
  };

  return {
    revertWithDraftInFlight,
    handleRevertWithDraft,
    canUndoRevertWithDraft,
    undoRevertWithDraftInFlight,
    handleUndoRevertWithDraft,
  };
}
