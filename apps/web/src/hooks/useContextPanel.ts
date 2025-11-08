/**
 * Context Panel Hook
 *
 * Manages the context panel state and handlers for text selection and context questions.
 * Extracted from dashboard page for better modularity and debugging.
 */

"use client";

import { useState } from "react";
import { askContextQuestion } from "@/lib/contextChatClient";

type UseContextPanelOptions = {
  selection: { text: string; x: number; y: number } | null;
  clearSelection: () => void;
  threadMessages: { role: "user" | "assistant"; content: string }[];
};

type UseContextPanelResult = {
  isContextPanelOpen: boolean;
  selectedContextText: string;
  handleAddContext: () => void;
  handleCloseContextPanel: () => void;
  handleContextSubmit: (
    question: string,
    contextText: string,
    threadMessages?: { role: "user" | "assistant"; content: string }[]
  ) => Promise<string>;
};

export function useContextPanel(options: UseContextPanelOptions): UseContextPanelResult {
  const { selection, clearSelection, threadMessages } = options;

  const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
  const [selectedContextText, setSelectedContextText] = useState("");

  const handleAddContext = () => {
    if (!selection) return;

    setSelectedContextText(selection.text);
    setIsContextPanelOpen(true);
    clearSelection();
  };

  const handleCloseContextPanel = () => {
    setIsContextPanelOpen(false);
    setSelectedContextText("");
  };

  const handleContextSubmit = async (
    question: string,
    contextText: string,
    threadMessagesParam?: { role: "user" | "assistant"; content: string }[]
  ): Promise<string> => {
    try {
      // Use provided thread messages or fall back to the hook's thread messages
      const messagesToUse = threadMessagesParam || threadMessages;
      const response = await askContextQuestion(question, contextText, messagesToUse);
      return response;
    } catch (error) {
      console.error("Error in context question:", error);
      throw error;
    }
  };

  return {
    isContextPanelOpen,
    selectedContextText,
    handleAddContext,
    handleCloseContextPanel,
    handleContextSubmit,
  };
}
