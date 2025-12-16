"use client";

/**
 * useChatbots Hook
 *
 * Manages chatbot configurations with CRUD operations.
 * Follows the useThreads pattern for consistency.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Chatbot, CreateChatbotInput, UpdateChatbotInput } from "@/types/chatbot";
import type { ChatbotFileConfig } from "@/types/chatbotFile";

export type UseChatbotsResult = {
  chatbots: Chatbot[];
  loadingChatbots: boolean;
  chatbotsError: string | null;
  selectedChatbotId: string | null;
  selectChatbot: (id: string | null) => void;
  createChatbot: (input: CreateChatbotInput) => Promise<Chatbot | null>;
  updateChatbot: (id: string, updates: UpdateChatbotInput) => Promise<boolean>;
  deleteChatbot: (id: string) => Promise<boolean>;
  duplicateChatbot: (id: string, newName?: string) => Promise<Chatbot | null>;
  getChatbotById: (id: string) => Chatbot | undefined;
  refreshChatbots: () => Promise<void>;
};

/**
 * Gets or creates the default chatbot folder
 */
async function getOrCreateDefaultChatbotFolder(userId: string): Promise<string | null> {
  try {
    // Check for existing default folder
    const { data: existing } = await supabase
      .from("chatbot_folders")
      .select("id")
      .eq("user_id", userId)
      .eq("is_default", true)
      .single();

    if (existing) return existing.id;

    // Create default folder if it doesn't exist
    const { data: newFolder, error: createError } = await supabase
      .from("chatbot_folders")
      .insert({
        user_id: userId,
        name: "General",
        is_default: true,
        position: 0,
      })
      .select()
      .single();

    if (createError) {
      console.error("[useChatbots] Error creating default folder:", createError);
      return null;
    }

    return newFolder?.id ?? null;
  } catch (err) {
    console.error("[useChatbots] Error getting/creating default folder:", err);
    return null;
  }
}

export function useChatbots(userId: string | null | undefined): UseChatbotsResult {
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [loadingChatbots, setLoadingChatbots] = useState(false);
  const [chatbotsError, setChatbotsError] = useState<string | null>(null);
  const [selectedChatbotId, setSelectedChatbotId] = useState<string | null>(null);
  const defaultFolderIdRef = useRef<string | null>(null);

  // Fetch default folder on mount
  useEffect(() => {
    if (!userId) {
      defaultFolderIdRef.current = null;
      return;
    }
    getOrCreateDefaultChatbotFolder(userId).then(id => {
      defaultFolderIdRef.current = id;
    });
  }, [userId]);

  // Fetch chatbots when userId changes
  useEffect(() => {
    if (!userId) {
      setChatbots([]);
      setSelectedChatbotId(null);
      return;
    }
    void refreshChatbots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const refreshChatbots = useCallback(async () => {
    if (!userId) return;
    setLoadingChatbots(true);
    setChatbotsError(null);

    try {
      const { data, error } = await supabase
        .from("chatbots")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      setChatbots(data ?? []);
    } catch (err: any) {
      setChatbotsError(err.message ?? "Failed to load chatbots");
    } finally {
      setLoadingChatbots(false);
    }
  }, [userId]);

  const selectChatbot = useCallback((id: string | null) => {
    setSelectedChatbotId(id);
  }, []);

  const createChatbot = useCallback(async (input: CreateChatbotInput): Promise<Chatbot | null> => {
    if (!userId) return null;

    try {
      // Use provided folder_id or fall back to default folder
      const targetFolderId = input.folder_id !== undefined ? input.folder_id : defaultFolderIdRef.current;

      // Get the highest position in the target folder
      const siblingsInFolder = chatbots.filter(c => c.folder_id === targetFolderId);
      const maxPosition = siblingsInFolder.length > 0
        ? Math.max(...siblingsInFolder.map(c => c.position)) + 1
        : 0;

      const { data, error } = await supabase
        .from("chatbots")
        .insert({
          user_id: userId,
          name: input.name,
          description: input.description || null,
          folder_id: targetFolderId,
          position: maxPosition,
          config: input.config,
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) return null;

      setChatbots(prev => [data, ...prev]);
      return data;
    } catch (err: any) {
      console.error("[useChatbots] Error creating chatbot:", err);
      setChatbotsError(err.message ?? "Failed to create chatbot");
      return null;
    }
  }, [userId, chatbots]);

  const updateChatbot = useCallback(async (id: string, updates: UpdateChatbotInput): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from("chatbots")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;

      // Update local state
      setChatbots(prev =>
        prev.map(c => c.id === id ? { ...c, ...updates } as Chatbot : c)
      );

      return true;
    } catch (err: any) {
      console.error("[useChatbots] Error updating chatbot:", err);
      setChatbotsError(err.message ?? "Failed to update chatbot");
      return false;
    }
  }, [userId]);

  const deleteChatbot = useCallback(async (id: string): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from("chatbots")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;

      // Update local state
      setChatbots(prev => prev.filter(c => c.id !== id));

      // Clear selection if deleted chatbot was selected
      if (selectedChatbotId === id) {
        setSelectedChatbotId(null);
      }

      return true;
    } catch (err: any) {
      console.error("[useChatbots] Error deleting chatbot:", err);
      setChatbotsError(err.message ?? "Failed to delete chatbot");
      return false;
    }
  }, [userId, selectedChatbotId]);

  const duplicateChatbot = useCallback(async (id: string, newName?: string): Promise<Chatbot | null> => {
    if (!userId) return null;

    const original = chatbots.find(c => c.id === id);
    if (!original) {
      setChatbotsError("Chatbot not found");
      return null;
    }

    const duplicatedName = newName || `${original.name} (Copy)`;

    return createChatbot({
      name: duplicatedName,
      description: original.description || undefined,
      folder_id: original.folder_id,
      config: { ...original.config },
    });
  }, [userId, chatbots, createChatbot]);

  const getChatbotById = useCallback((id: string): Chatbot | undefined => {
    return chatbots.find(c => c.id === id);
  }, [chatbots]);

  return {
    chatbots,
    loadingChatbots,
    chatbotsError,
    selectedChatbotId,
    selectChatbot,
    createChatbot,
    updateChatbot,
    deleteChatbot,
    duplicateChatbot,
    getChatbotById,
    refreshChatbots,
  };
}
