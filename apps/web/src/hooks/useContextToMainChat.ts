/**
 * Context-to-Main-Chat Hook
 *
 * Provides functionality to add context panel conversations to the main chat thread.
 * This allows users to preserve important context conversations by merging them
 * into the main conversation history.
 */

import { useState, useCallback } from "react";

type ContextMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type UseContextToMainChatProps = {
  onAddToMainChat: (contextMessages: ContextMessage[], contextSections: string[]) => Promise<void>;
};

export function useContextToMainChat({ onAddToMainChat }: UseContextToMainChatProps) {
  const [isAdding, setIsAdding] = useState(false);

  const addContextToMainChat = useCallback(
    async (contextMessages: ContextMessage[], contextSections: string[]) => {
      if (isAdding || contextMessages.length === 0) return;

      setIsAdding(true);

      try {
        await onAddToMainChat(contextMessages, contextSections);
      } catch (error) {
        console.error("Error adding context to main chat:", error);
        throw error;
      } finally {
        setIsAdding(false);
      }
    },
    [isAdding, onAddToMainChat]
  );

  return {
    isAdding,
    addContextToMainChat,
  };
}
