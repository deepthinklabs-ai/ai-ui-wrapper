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
  sendMessage: (content: string, files?: File[]) => Promise<void>;
};

type UseMessageCompositionResult = {
  draft: string;
  setDraft: (value: string) => void;
  attachedFiles: File[];
  setAttachedFiles: (files: File[]) => void;
  handleSend: () => Promise<void>;
};

export function useMessageComposition(options: UseMessageCompositionOptions): UseMessageCompositionResult {
  const { selectedThreadId, sendMessage } = options;

  const [draft, setDraft] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);

  const handleSend = async () => {
    const content = draft.trim();
    if ((!content && attachedFiles.length === 0) || !selectedThreadId) return;

    // Send message with files
    await sendMessage(content || "Here are the files:", attachedFiles);

    // Clear draft and files after sending
    setDraft("");
    setAttachedFiles([]);
  };

  return {
    draft,
    setDraft,
    attachedFiles,
    setAttachedFiles,
    handleSend,
  };
}
