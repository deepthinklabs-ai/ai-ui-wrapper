/**
 * Message Composition Hook
 *
 * Manages message draft, file attachments, and sending logic.
 * Extracted from dashboard page for better modularity and debugging.
 */

"use client";

import { useState } from "react";

type UseMessageCompositionOptions = {
  selectedThreadId: string | null;
  sendMessage: (content: string, files?: File[], overrideThreadId?: string) => Promise<void>;
  createThread?: () => Promise<string | null>;
  onThreadCreated?: () => void;
};

type UseMessageCompositionResult = {
  draft: string;
  setDraft: (value: string) => void;
  attachedFiles: File[];
  setAttachedFiles: (files: File[]) => void;
  handleSend: () => Promise<void>;
};

export function useMessageComposition(options: UseMessageCompositionOptions): UseMessageCompositionResult {
  const { selectedThreadId, sendMessage, createThread, onThreadCreated } = options;

  const [draft, setDraft] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content && attachedFiles.length === 0) return;

    // Determine which thread to use
    let threadId = selectedThreadId;

    // If no thread is selected and createThread is provided, create a new thread first
    if (!threadId && createThread) {
      const newThreadId = await createThread();
      if (!newThreadId) {
        console.error("Failed to create thread");
        return;
      }
      threadId = newThreadId;
      // Notify that a thread was created (may have also created default folder)
      onThreadCreated?.();
    }

    // If we still don't have a thread ID, we can't send the message
    if (!threadId) {
      console.error("No thread ID available to send message");
      return;
    }

    // Store the files to send
    const filesToSend = [...attachedFiles];

    // Clear draft and files immediately before sending (for better UX)
    setDraft("");
    setAttachedFiles([]);

    // Send message with files, passing the thread ID
    await sendMessage(content || "Here are the files:", filesToSend, threadId);
  };

  return {
    draft,
    setDraft,
    attachedFiles,
    setAttachedFiles,
    handleSend,
  };
}
