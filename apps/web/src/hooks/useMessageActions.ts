/**
 * Message Actions Hook
 *
 * Handles message-level operations like reverting to a point in conversation
 * or forking from a specific message. Provides version control for threads.
 */

"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Message } from "@/types/chat";

type UseMessageActionsOptions = {
  threadId: string | null;
  currentThreadTitle: string | null;
  messages: Message[];
  refreshMessages: () => Promise<void>;
  forkThread: (threadId: string, messages: { role: string; content: string; model: string | null }[]) => Promise<string | null>;
  refreshThreads: () => Promise<void>;
};

type UseMessageActionsResult = {
  revertInFlight: boolean;
  forkFromMessageInFlight: boolean;
  handleRevertToMessage: (messageId: string) => Promise<void>;
  handleForkFromMessage: (messageId: string) => Promise<void>;
};

export function useMessageActions(options: UseMessageActionsOptions): UseMessageActionsResult {
  const {
    threadId,
    currentThreadTitle,
    messages,
    refreshMessages,
    forkThread,
    refreshThreads,
  } = options;

  const [revertInFlight, setRevertInFlight] = useState(false);
  const [forkFromMessageInFlight, setForkFromMessageInFlight] = useState(false);

  /**
   * Revert thread to a specific message by deleting all messages after it
   */
  const handleRevertToMessage = async (messageId: string) => {
    if (!threadId) return;

    // Find the index of the target message
    const targetIndex = messages.findIndex(m => m.id === messageId);
    if (targetIndex === -1) return;

    // Get all messages that come after this one
    const messagesToDelete = messages.slice(targetIndex + 1);

    if (messagesToDelete.length === 0) {
      console.log("No messages to delete - already at the end");
      return;
    }

    // Confirm with user
    const confirmed = window.confirm(
      `Are you sure you want to revert to this message? This will delete ${messagesToDelete.length} message(s) that come after it.`
    );

    if (!confirmed) return;

    setRevertInFlight(true);
    try {
      // Delete all messages after the target message
      const messageIdsToDelete = messagesToDelete.map(m => m.id);

      const { error } = await supabase
        .from("messages")
        .delete()
        .in("id", messageIdsToDelete);

      if (error) throw error;

      console.log(`Reverted thread to message ${messageId}, deleted ${messagesToDelete.length} messages`);

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
  };
}
