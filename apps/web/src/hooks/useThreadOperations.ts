/**
 * Thread Operations Hook
 *
 * Handles complex thread operations like summarizing, forking, and continuing threads.
 * Extracted from dashboard page for better modularity and debugging.
 */

"use client";

import { useState } from "react";
import type { Message } from "@/types/chat";

type UseThreadOperationsOptions = {
  selectedThreadId: string | null;
  messages: Message[];
  currentThreadTitle: string | null;
  generateSummary: () => Promise<string>;
  createThreadWithContext: (contextMessage: string, title?: string) => Promise<string | null>;
  forkThread: (threadId: string, messages: { role: string; content: string; model: string | null }[]) => Promise<string | null>;
  summarizeThread: () => Promise<void>;
  refreshThreads: () => Promise<void>;
};

type UseThreadOperationsResult = {
  summarizeAndContinueInFlight: boolean;
  forkInFlight: boolean;
  handleSummarize: () => Promise<void>;
  handleSummarizeAndContinue: () => Promise<void>;
  handleFork: () => Promise<void>;
};

export function useThreadOperations(options: UseThreadOperationsOptions): UseThreadOperationsResult {
  const {
    selectedThreadId,
    messages,
    currentThreadTitle,
    generateSummary,
    createThreadWithContext,
    forkThread,
    summarizeThread,
    refreshThreads,
  } = options;

  const [summarizeAndContinueInFlight, setSummarizeAndContinueInFlight] = useState(false);
  const [forkInFlight, setForkInFlight] = useState(false);

  const handleSummarize = async () => {
    if (!selectedThreadId) return;
    await summarizeThread();
  };

  const handleSummarizeAndContinue = async () => {
    if (!selectedThreadId || messages.length === 0) return;

    setSummarizeAndContinueInFlight(true);
    try {
      // 1. Generate the summary
      const summary = await generateSummary();

      // 2. Create a new thread with the summary as context
      const newThreadId = await createThreadWithContext(
        summary,
        "Continued: " + (currentThreadTitle || "Thread")
      );

      if (newThreadId) {
        // 3. Refresh the threads list to ensure UI is in sync
        await refreshThreads();

        // Thread is automatically selected by createThreadWithContext
        console.log("Created new thread with context:", newThreadId);
      }
    } catch (error) {
      console.error("Error in summarize and continue:", error);
    } finally {
      setSummarizeAndContinueInFlight(false);
    }
  };

  const handleFork = async () => {
    if (!selectedThreadId || messages.length === 0) return;

    setForkInFlight(true);
    try {
      // Fork the thread with all current messages
      const newThreadId = await forkThread(selectedThreadId, messages);

      if (newThreadId) {
        // Refresh the threads list to ensure UI is in sync
        await refreshThreads();

        // Thread is automatically selected by forkThread
        console.log("Forked thread:", newThreadId);
      }
    } catch (error) {
      console.error("Error forking thread:", error);
    } finally {
      setForkInFlight(false);
    }
  };

  return {
    summarizeAndContinueInFlight,
    forkInFlight,
    handleSummarize,
    handleSummarizeAndContinue,
    handleFork,
  };
}
