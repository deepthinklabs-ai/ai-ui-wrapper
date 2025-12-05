/**
 * Thread Context Hook
 *
 * Manages thread selection for context panel, allowing users to
 * add .thread files as context for AI questions.
 *
 * Messages are decrypted before being added to context.
 */

"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useEncryption } from "@/contexts/EncryptionContext";

export type ThreadContextSection = {
  threadId: string;
  threadTitle: string;
  content: string; // Formatted messages from the thread (decrypted)
  messageCount: number;
};

type UseThreadContextResult = {
  threadContextSections: ThreadContextSection[];
  isLoadingThread: boolean;
  addThreadToContext: (threadId: string, threadTitle: string) => Promise<void>;
  removeThreadFromContext: (threadId: string) => void;
  clearThreadContext: () => void;
  hasThreadContext: boolean;
  // Convert to string array for compatibility with existing context panel
  getContextStrings: () => string[];
};

export function useThreadContext(): UseThreadContextResult {
  const [threadContextSections, setThreadContextSections] = useState<ThreadContextSection[]>([]);
  const [isLoadingThread, setIsLoadingThread] = useState(false);

  // Get encryption functions
  const { decryptText, isReady: isEncryptionReady, isEncryptedData } = useEncryption();

  const addThreadToContext = useCallback(async (threadId: string, threadTitle: string) => {
    // Check if already added
    if (threadContextSections.some((s) => s.threadId === threadId)) {
      return;
    }

    setIsLoadingThread(true);

    try {
      // Fetch messages for the thread
      const { data: messages, error } = await supabase
        .from("messages")
        .select("role, content, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching thread messages:", error);
        return;
      }

      if (!messages || messages.length === 0) {
        // Add empty thread context
        setThreadContextSections((prev) => [
          ...prev,
          {
            threadId,
            threadTitle,
            content: "(This thread is empty)",
            messageCount: 0,
          },
        ]);
        return;
      }

      // Decrypt and format messages into readable context
      const decryptedMessages = await Promise.all(
        messages.map(async (msg) => {
          let content = msg.content;

          // Check if content is encrypted and encryption is ready
          if (isEncryptionReady && isEncryptedData(content)) {
            try {
              content = await decryptText(content);
            } catch (err) {
              console.error("Failed to decrypt message:", err);
              content = "[Unable to decrypt message]";
            }
          }

          return {
            role: msg.role,
            content,
          };
        })
      );

      // Format messages into readable context
      const formattedContent = decryptedMessages
        .map((msg) => {
          const role = msg.role === "user" ? "User" : "Assistant";
          return `[${role}]: ${msg.content}`;
        })
        .join("\n\n");

      setThreadContextSections((prev) => [
        ...prev,
        {
          threadId,
          threadTitle,
          content: formattedContent,
          messageCount: messages.length,
        },
      ]);
    } catch (err) {
      console.error("Error adding thread to context:", err);
    } finally {
      setIsLoadingThread(false);
    }
  }, [threadContextSections, decryptText, isEncryptionReady, isEncryptedData]);

  const removeThreadFromContext = useCallback((threadId: string) => {
    setThreadContextSections((prev) => prev.filter((s) => s.threadId !== threadId));
  }, []);

  const clearThreadContext = useCallback(() => {
    setThreadContextSections([]);
  }, []);

  // Convert to string array for compatibility with existing ContextPanel
  const getContextStrings = useCallback((): string[] => {
    return threadContextSections.map((section) => {
      return `--- Thread: ${section.threadTitle}.thread (${section.messageCount} messages) ---\n\n${section.content}`;
    });
  }, [threadContextSections]);

  return {
    threadContextSections,
    isLoadingThread,
    addThreadToContext,
    removeThreadFromContext,
    clearThreadContext,
    hasThreadContext: threadContextSections.length > 0,
    getContextStrings,
  };
}
