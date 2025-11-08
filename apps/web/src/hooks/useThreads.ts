"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Thread } from "@/types/chat";

type UseThreadsResult = {
  threads: Thread[];
  loadingThreads: boolean;
  threadsError: string | null;
  selectedThreadId: string | null;
  selectThread: (id: string) => void;
  createThread: () => Promise<void>;
  createThreadWithContext: (contextMessage: string, title?: string) => Promise<string | null>;
  forkThread: (threadId: string, messages: { role: string; content: string; model: string | null }[]) => Promise<string | null>;
  deleteThread: (id: string) => Promise<void>;
  refreshThreads: () => Promise<void>;
};

export function useThreads(userId: string | null | undefined): UseThreadsResult {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [threadsError, setThreadsError] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

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

  const createThread = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase
        .from("threads")
        .insert({
          user_id: userId,
          title: "New thread",
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) return;

      setThreads((prev) => [data, ...prev]);
      setSelectedThreadId(data.id);
    } catch (err) {
      console.error("Error creating thread", err);
    }
  };

  const createThreadWithContext = async (
    contextMessage: string,
    title: string = "Continued Thread"
  ): Promise<string | null> => {
    if (!userId) return null;
    try {
      // 1. Create the new thread
      const { data: newThread, error: threadError } = await supabase
        .from("threads")
        .insert({
          user_id: userId,
          title,
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
    try {
      // 1. Get the original thread title
      const originalThread = threads.find(t => t.id === threadId);
      const originalTitle = originalThread?.title || "Thread";
      const newTitle = `Fork of ${originalTitle}`;

      // 2. Create the new thread
      const { data: newThread, error: threadError } = await supabase
        .from("threads")
        .insert({
          user_id: userId,
          title: newTitle,
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
    refreshThreads,
  };
}
