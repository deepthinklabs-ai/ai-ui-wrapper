/**
 * Context Panel Hook
 *
 * Manages the context panel state and handlers for text selection and context questions.
 * Extracted from dashboard page for better modularity and debugging.
 */

"use client";

import { useState } from "react";
import { askContextQuestion } from "@/lib/contextChatClient";
import type { UserTier } from "@/hooks/useUserTier";

type UseContextPanelOptions = {
  selection: { text: string; x: number; y: number } | null;
  clearSelection: () => void;
  threadMessages: { role: "user" | "assistant"; content: string }[];
  userTier?: UserTier;
  userId?: string;
};

type UseContextPanelResult = {
  isContextPanelOpen: boolean;
  setIsContextPanelOpen: (open: boolean) => void;
  selectedContextSections: string[];
  handleAddContext: () => void;
  handleRemoveContextSection: (index: number) => void;
  handleCloseContextPanel: () => void;
  handleContextSubmit: (
    question: string,
    contextSections: string[],
    threadMessagesParam?: { role: "user" | "assistant"; content: string }[],
    files?: File[]
  ) => Promise<string>;
};

export function useContextPanel(options: UseContextPanelOptions): UseContextPanelResult {
  const { selection, clearSelection, threadMessages, userTier, userId } = options;

  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
  const [selectedContextSections, setSelectedContextSections] = useState<string[]>([]);

  const handleAddContext = () => {
    if (!selection) return;

    // If panel is already open, add to existing sections
    if (isContextPanelOpen) {
      setSelectedContextSections((prev) => [...prev, selection.text]);
    } else {
      // First selection - open panel with this text
      setSelectedContextSections([selection.text]);
      setIsContextPanelOpen(true);
    }

    clearSelection();
  };

  const handleRemoveContextSection = (index: number) => {
    setSelectedContextSections((prev) => {
      const newSections = prev.filter((_, i) => i !== index);
      // If no sections left, close the panel
      if (newSections.length === 0) {
        setIsContextPanelOpen(false);
      }
      return newSections;
    });
  };

  const handleCloseContextPanel = () => {
    setIsContextPanelOpen(false);
    setSelectedContextSections([]);
  };

  const handleContextSubmit = async (
    question: string,
    contextSections: string[],
    threadMessagesParam?: { role: "user" | "assistant"; content: string }[],
    files?: File[]
  ): Promise<string> => {
    try {
      // Use provided thread messages or fall back to the hook's thread messages
      const messagesToUse = threadMessagesParam || threadMessages;
      const response = await askContextQuestion(question, contextSections, messagesToUse, files, userTier, userId);
      return response;
    } catch (error) {
      console.error("Error in context question:", error);
      throw error;
    }
  };

  return {
    isContextPanelOpen,
    setIsContextPanelOpen,
    selectedContextSections,
    handleAddContext,
    handleRemoveContextSection,
    handleCloseContextPanel,
    handleContextSubmit,
  };
}
