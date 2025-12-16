"use client";

/**
 * useActiveChatbot Hook
 *
 * Manages the active chatbot configuration for the current thread.
 * Handles thread-chatbot associations (switchable relationship).
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Chatbot } from "@/types/chatbot";
import type { ChatbotFileConfig } from "@/types/chatbotFile";

export type UseActiveChatbotResult = {
  /** The currently active chatbot for the selected thread (null = using defaults) */
  activeChatbot: Chatbot | null;
  /** Whether the chatbot is being loaded */
  loadingActiveChatbot: boolean;
  /** Error message if any */
  activeChatbotError: string | null;
  /** Associate a chatbot with a thread */
  setThreadChatbot: (threadId: string, chatbotId: string | null) => Promise<boolean>;
  /** Remove chatbot association from a thread */
  clearThreadChatbot: (threadId: string) => Promise<boolean>;
  /** Get the config to apply (from active chatbot or null for defaults) */
  getActiveConfig: () => ChatbotFileConfig | null;
  /** Check if using a chatbot vs defaults */
  isUsingChatbot: boolean;
  /** Refresh the active chatbot from the thread */
  refreshActiveChatbot: () => Promise<void>;
};

type UseActiveChatbotOptions = {
  /** Callback when thread's chatbot association changes */
  onChatbotChanged?: (chatbotId: string | null) => void;
};

export function useActiveChatbot(
  userId: string | null | undefined,
  selectedThreadId: string | null,
  chatbots: Chatbot[],
  options: UseActiveChatbotOptions = {}
): UseActiveChatbotResult {
  const { onChatbotChanged } = options;
  const [activeChatbotId, setActiveChatbotId] = useState<string | null>(null);
  const [loadingActiveChatbot, setLoadingActiveChatbot] = useState(false);
  const [activeChatbotError, setActiveChatbotError] = useState<string | null>(null);

  // Find the active chatbot from the list
  const activeChatbot = useMemo(() => {
    if (!activeChatbotId) return null;
    return chatbots.find(c => c.id === activeChatbotId) ?? null;
  }, [activeChatbotId, chatbots]);

  // Load thread's chatbot_id when thread changes
  useEffect(() => {
    if (!userId || !selectedThreadId) {
      setActiveChatbotId(null);
      return;
    }

    void refreshActiveChatbot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, selectedThreadId]);

  const refreshActiveChatbot = useCallback(async () => {
    if (!userId || !selectedThreadId) {
      setActiveChatbotId(null);
      return;
    }

    setLoadingActiveChatbot(true);
    setActiveChatbotError(null);

    try {
      const { data, error } = await supabase
        .from("threads")
        .select("chatbot_id")
        .eq("id", selectedThreadId)
        .eq("user_id", userId)
        .single();

      if (error) throw error;

      setActiveChatbotId(data?.chatbot_id ?? null);
    } catch (err: any) {
      console.error("[useActiveChatbot] Error loading active chatbot:", err);
      setActiveChatbotError(err.message ?? "Failed to load chatbot");
      setActiveChatbotId(null);
    } finally {
      setLoadingActiveChatbot(false);
    }
  }, [userId, selectedThreadId]);

  const setThreadChatbot = useCallback(async (threadId: string, chatbotId: string | null): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from("threads")
        .update({ chatbot_id: chatbotId })
        .eq("id", threadId)
        .eq("user_id", userId);

      if (error) throw error;

      // Update local state if this is the currently selected thread
      if (threadId === selectedThreadId) {
        setActiveChatbotId(chatbotId);
      }

      // Notify callback
      if (onChatbotChanged) {
        onChatbotChanged(chatbotId);
      }

      return true;
    } catch (err: any) {
      console.error("[useActiveChatbot] Error setting thread chatbot:", err);
      setActiveChatbotError(err.message ?? "Failed to set chatbot");
      return false;
    }
  }, [userId, selectedThreadId, onChatbotChanged]);

  const clearThreadChatbot = useCallback(async (threadId: string): Promise<boolean> => {
    return setThreadChatbot(threadId, null);
  }, [setThreadChatbot]);

  const getActiveConfig = useCallback((): ChatbotFileConfig | null => {
    return activeChatbot?.config ?? null;
  }, [activeChatbot]);

  const isUsingChatbot = activeChatbot !== null;

  return {
    activeChatbot,
    loadingActiveChatbot,
    activeChatbotError,
    setThreadChatbot,
    clearThreadChatbot,
    getActiveConfig,
    isUsingChatbot,
    refreshActiveChatbot,
  };
}
