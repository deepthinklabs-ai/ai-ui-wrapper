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

  return {
    threads,
    loadingThreads,
    threadsError,
    selectedThreadId,
    selectThread,
    createThread,
    refreshThreads,
  };
}
