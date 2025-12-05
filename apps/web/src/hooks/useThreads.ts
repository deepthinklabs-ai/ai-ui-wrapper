"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Thread } from "@/types/chat";
import { useUserTier, TIER_LIMITS } from "./useUserTier";

type UseThreadsResult = {
  threads: Thread[];
  loadingThreads: boolean;
  threadsError: string | null;
  selectedThreadId: string | null;
  selectThread: (id: string) => void;
  createThread: (name?: string, folderId?: string | null) => Promise<string | null>;
  createThreadWithContext: (contextMessage: string, title?: string) => Promise<string | null>;
  forkThread: (threadId: string, messages: { role: string; content: string; model: string | null }[]) => Promise<string | null>;
  deleteThread: (id: string) => Promise<void>;
  updateThreadTitle: (id: string, newTitle: string) => Promise<void>;
  refreshThreads: () => Promise<void>;
  canCreateThread: boolean;
  threadLimitReached: boolean;
};

/**
 * Gets or creates the default folder for thread creation
 */
async function getOrCreateDefaultFolder(userId: string): Promise<string | null> {
  try {
    // Check for existing default folder
    const { data: existing } = await supabase
      .from("folders")
      .select("id")
      .eq("user_id", userId)
      .eq("is_default", true)
      .single();

    if (existing) return existing.id;

    // Create default folder if it doesn't exist
    const { data: newFolder, error: createError } = await supabase
      .from("folders")
      .insert({
        user_id: userId,
        name: "General",
        is_default: true,
        position: 0,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating default folder:", createError);
      return null;
    }

    return newFolder?.id ?? null;
  } catch (err) {
    console.error("Error getting/creating default folder:", err);
    return null;
  }
}

export function useThreads(userId: string | null | undefined): UseThreadsResult {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const defaultFolderIdRef = useRef<string | null>(null);

  // Get user tier to enforce thread limits
  const { tier } = useUserTier(userId);
  const maxThreads = TIER_LIMITS[tier].maxThreads;
  const threadLimitReached = threads.length >= maxThreads;
  const canCreateThread = !threadLimitReached;

  // Fetch default folder on mount
  useEffect(() => {
    if (!userId) {
      defaultFolderIdRef.current = null;
      return;
    }
    getOrCreateDefaultFolder(userId).then(id => {
      defaultFolderIdRef.current = id;
    });
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setThreads([]);
      setSelectedThreadId(null);
      return;
    }
    void refreshThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const refreshThreads = async () => {
    if (!userId) return;
    setLoadingThreads(true);
    setThreadsError(null);
    try {
      const { data, error } = await supabase
        .from("threads")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setThreads(data ?? []);

      // Keep selection if possible, otherwise pick first
      if (!selectedThreadId && data && data.length > 0) {
        setSelectedThreadId(data[0].id);
      }
    } catch (err: any) {
      setThreadsError(err.message ?? "Failed to load threads");
    } finally {
      setLoadingThreads(false);
    }
  };

  const selectThread = (id: string) => {
    setSelectedThreadId(id);
  };

  const createThread = async (name?: string, folderId?: string | null): Promise<string | null> => {
    if (!userId) return null;

    // Check thread limit
    if (threadLimitReached) {
      setThreadsError(
        `You've reached the maximum of ${maxThreads} threads for the free tier. Please delete a thread or upgrade to Pro for unlimited threads.`
      );
      return null;
    }

    try {
      // Use provided folderId, or fall back to default folder
      const targetFolderId = folderId !== undefined ? folderId : defaultFolderIdRef.current;

      const { data, error } = await supabase
        .from("threads")
        .insert({
          user_id: userId,
          title: name || "Untitled",
          folder_id: targetFolderId,
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) return null;

      setThreads((prev) => [data, ...prev]);
      setSelectedThreadId(data.id);

      return data.id;
    } catch (err) {
      console.error("Error creating thread", err);
      return null;
    }
  };

  const createThreadWithContext = async (
    contextMessage: string,
    title: string = "Continued Thread"
  ): Promise<string | null> => {
    if (!userId) return null;

    // Check thread limit
    if (threadLimitReached) {
      setThreadsError(
        `You've reached the maximum of ${maxThreads} threads for the free tier. Please delete a thread or upgrade to Pro for unlimited threads.`
      );
      return null;
    }

    try {
      // 1. Create the new thread
      const { data: newThread, error: threadError } = await supabase
        .from("threads")
        .insert({
          user_id: userId,
          title,
          folder_id: defaultFolderIdRef.current,
        })
        .select()
        .single();

      if (threadError) throw threadError;
      if (!newThread) return null;

      // 2. Insert the context message (summary from previous thread)
      const { error: messageError } = await supabase
        .from("messages")
        .insert({
          thread_id: newThread.id,
          role: "assistant",
          content: `**Context from previous thread:**\n\n${contextMessage}`,
          model: "gpt-4o-mini",
        });

      if (messageError) throw messageError;

      // 3. Update local state and select the new thread
      setThreads((prev) => [newThread, ...prev]);
      setSelectedThreadId(newThread.id);

      return newThread.id;
    } catch (err) {
      console.error("Error creating thread with context", err);
      return null;
    }
  };

  const forkThread = async (
    threadId: string,
    messages: { role: string; content: string; model: string | null }[]
  ): Promise<string | null> => {
    if (!userId) return null;

    // Check thread limit
    if (threadLimitReached) {
      setThreadsError(
        `You've reached the maximum of ${maxThreads} threads for the free tier. Please delete a thread or upgrade to Pro for unlimited threads.`
      );
      return null;
    }

    try {
      // 1. Get the original thread title
      const originalThread = threads.find(t => t.id === threadId);
      const originalTitle = originalThread?.title || "Thread";
      const newTitle = `Fork of ${originalTitle}`;

      // 2. Create the new thread (in same folder as original, or default folder)
      const originalFolderId = originalThread?.folder_id ?? defaultFolderIdRef.current;
      const { data: newThread, error: threadError } = await supabase
        .from("threads")
        .insert({
          user_id: userId,
          title: newTitle,
          folder_id: originalFolderId,
        })
        .select()
        .single();

      if (threadError) throw threadError;
      if (!newThread) return null;

      // 3. Copy all messages from the original thread to the new thread
      if (messages.length > 0) {
        const messagesToInsert = messages.map(msg => ({
          thread_id: newThread.id,
          role: msg.role,
          content: msg.content,
          model: msg.model,
        }));

        const { error: messagesError } = await supabase
          .from("messages")
          .insert(messagesToInsert);

        if (messagesError) throw messagesError;
      }

      // 4. Update local state and select the new thread
      setThreads((prev) => [newThread, ...prev]);
      setSelectedThreadId(newThread.id);

      return newThread.id;
    } catch (err) {
      console.error("Error forking thread", err);
      setThreadsError("Failed to fork thread");
      return null;
    }
  };

  const deleteThread = async (id: string) => {
    if (!userId) return;
    try {
      // Delete the thread from the database
      const { error } = await supabase
        .from("threads")
        .delete()
        .eq("id", id)
        .eq("user_id", userId); // Ensure user owns this thread

      if (error) throw error;

      // Update local state
      setThreads((prev) => prev.filter((t) => t.id !== id));

      // If the deleted thread was selected, select another one or null
      if (selectedThreadId === id) {
        const remainingThreads = threads.filter((t) => t.id !== id);
        if (remainingThreads.length > 0) {
          setSelectedThreadId(remainingThreads[0].id);
        } else {
          setSelectedThreadId(null);
        }
      }
    } catch (err) {
      console.error("Error deleting thread", err);
      setThreadsError("Failed to delete thread");
    }
  };

  const updateThreadTitle = async (id: string, newTitle: string) => {
    if (!userId) return;
    try {
      // Update the thread title in the database
      const { error } = await supabase
        .from("threads")
        .update({ title: newTitle })
        .eq("id", id)
        .eq("user_id", userId); // Ensure user owns this thread

      if (error) throw error;

      // Update local state
      setThreads((prev) =>
        prev.map((t) => (t.id === id ? { ...t, title: newTitle } : t))
      );
    } catch (err) {
      console.error("Error updating thread title", err);
      setThreadsError("Failed to update thread title");
    }
  };

  return {
    threads,
    loadingThreads,
    threadsError,
    selectedThreadId,
    selectThread,
    createThread,
    createThreadWithContext,
    forkThread,
    deleteThread,
    updateThreadTitle,
    refreshThreads,
    canCreateThread,
    threadLimitReached,
  };
}
