"use client";

/**
 * useChatbotFolders Hook
 *
 * Manages chatbot folder organization with tree structure support.
 * Follows the useFolders pattern for consistency.
 */

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import type {
  Chatbot,
  ChatbotFolder,
  ChatbotFolderWithChildren,
  CreateChatbotFolderInput,
  UpdateChatbotFolderInput,
} from "@/types/chatbot";

export type UseChatbotFoldersResult = {
  folders: ChatbotFolder[];
  folderTree: ChatbotFolderWithChildren[];
  defaultFolderId: string | null;
  loadingFolders: boolean;
  foldersError: string | null;
  createFolder: (input: CreateChatbotFolderInput) => Promise<ChatbotFolder | null>;
  updateFolder: (id: string, updates: UpdateChatbotFolderInput) => Promise<boolean>;
  deleteFolder: (id: string) => Promise<boolean>;
  moveFolder: (folderId: string, newParentId: string | null) => Promise<boolean>;
  moveChatbot: (chatbotId: string, folderId: string | null) => Promise<boolean>;
  reorderFolders: (folderId: string, newPosition: number, parentId: string | null) => Promise<boolean>;
  reorderChatbots: (chatbotId: string, newPosition: number, folderId: string | null) => Promise<boolean>;
  toggleFolderCollapse: (folderId: string) => Promise<boolean>;
  getOrCreateDefaultFolder: () => Promise<string | null>;
  refreshFolders: () => Promise<void>;
};

/**
 * Build a tree structure from flat folder list
 */
function buildChatbotFolderTree(folders: ChatbotFolder[], chatbots: Chatbot[]): ChatbotFolderWithChildren[] {
  // Create a map for quick lookup
  const folderMap = new Map<string, ChatbotFolderWithChildren>();

  // Initialize all folders with empty children and chatbots
  folders.forEach(folder => {
    folderMap.set(folder.id, {
      ...folder,
      children: [],
      chatbots: [],
    });
  });

  // Assign chatbots to their folders
  chatbots.forEach(chatbot => {
    if (chatbot.folder_id && folderMap.has(chatbot.folder_id)) {
      folderMap.get(chatbot.folder_id)!.chatbots.push(chatbot);
    }
  });

  // Sort chatbots within each folder by position
  folderMap.forEach(folder => {
    folder.chatbots.sort((a, b) => a.position - b.position);
  });

  // Build tree structure
  const rootFolders: ChatbotFolderWithChildren[] = [];

  folders.forEach(folder => {
    const folderWithChildren = folderMap.get(folder.id)!;

    if (folder.parent_id && folderMap.has(folder.parent_id)) {
      // Add to parent's children
      folderMap.get(folder.parent_id)!.children.push(folderWithChildren);
    } else {
      // Add to root
      rootFolders.push(folderWithChildren);
    }
  });

  // Sort children within each folder by position
  const sortChildren = (folder: ChatbotFolderWithChildren) => {
    folder.children.sort((a, b) => a.position - b.position);
    folder.children.forEach(sortChildren);
  };

  rootFolders.sort((a, b) => a.position - b.position);
  rootFolders.forEach(sortChildren);

  return rootFolders;
}

type UseChatbotFoldersOptions = {
  onChatbotMoved?: () => void;
};

export function useChatbotFolders(
  userId: string | null | undefined,
  chatbots: Chatbot[],
  options: UseChatbotFoldersOptions = {}
): UseChatbotFoldersResult {
  const { onChatbotMoved } = options;
  const [folders, setFolders] = useState<ChatbotFolder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [foldersError, setFoldersError] = useState<string | null>(null);

  // Build tree structure whenever folders or chatbots change
  const folderTree = buildChatbotFolderTree(folders, chatbots);

  const refreshFolders = useCallback(async () => {
    if (!userId) return;
    setLoadingFolders(true);
    setFoldersError(null);

    try {
      const { data, error } = await supabase
        .from("chatbot_folders")
        .select("*")
        .eq("user_id", userId)
        .order("position", { ascending: true });

      if (error) throw error;
      setFolders(data ?? []);
    } catch (err: any) {
      setFoldersError(err.message ?? "Failed to load chatbot folders");
    } finally {
      setLoadingFolders(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setFolders([]);
      return;
    }
    void refreshFolders();
  }, [userId, refreshFolders]);

  const createFolder = useCallback(async (input: CreateChatbotFolderInput): Promise<ChatbotFolder | null> => {
    if (!userId) return null;

    try {
      // Get the highest position among siblings to add at the end
      const siblings = folders.filter(f => f.parent_id === (input.parent_id || null));
      const maxPosition = siblings.length > 0
        ? Math.max(...siblings.map(f => f.position)) + 1
        : 0;

      const { data, error } = await supabase
        .from("chatbot_folders")
        .insert({
          user_id: userId,
          parent_id: input.parent_id || null,
          name: input.name,
          color: input.color || null,
          icon: input.icon || null,
          position: maxPosition,
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) return null;

      setFolders(prev => [...prev, data]);
      return data;
    } catch (err: any) {
      console.error("[useChatbotFolders] Error creating folder:", err);
      setFoldersError(err.message ?? "Failed to create folder");
      return null;
    }
  }, [userId, folders]);

  const updateFolder = useCallback(async (id: string, updates: UpdateChatbotFolderInput): Promise<boolean> => {
    if (!userId) return false;

    try {
      const { error } = await supabase
        .from("chatbot_folders")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;

      setFolders(prev =>
        prev.map(f => f.id === id ? { ...f, ...updates } as ChatbotFolder : f)
      );

      return true;
    } catch (err: any) {
      console.error("[useChatbotFolders] Error updating folder:", err);
      setFoldersError(err.message ?? "Failed to update folder");
      return false;
    }
  }, [userId]);

  const deleteFolder = useCallback(async (id: string): Promise<boolean> => {
    if (!userId) return false;

    // Prevent deletion of default folder
    const folder = folders.find(f => f.id === id);
    if (folder?.is_default) {
      setFoldersError("Cannot delete the default folder");
      return false;
    }

    try {
      const { error } = await supabase
        .from("chatbot_folders")
        .delete()
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;

      // Remove folder and all its descendants from local state
      const getDescendantIds = (folderId: string): string[] => {
        const descendants: string[] = [];
        const children = folders.filter(f => f.parent_id === folderId);
        children.forEach(child => {
          descendants.push(child.id);
          descendants.push(...getDescendantIds(child.id));
        });
        return descendants;
      };

      const idsToRemove = new Set([id, ...getDescendantIds(id)]);
      setFolders(prev => prev.filter(f => !idsToRemove.has(f.id)));

      return true;
    } catch (err: any) {
      console.error("[useChatbotFolders] Error deleting folder:", err);
      setFoldersError(err.message ?? "Failed to delete folder");
      return false;
    }
  }, [userId, folders]);

  const moveFolder = useCallback(async (folderId: string, newParentId: string | null): Promise<boolean> => {
    if (!userId) return false;

    try {
      // Get position for new parent's children
      const newSiblings = folders.filter(f => f.parent_id === newParentId && f.id !== folderId);
      const maxPosition = newSiblings.length > 0
        ? Math.max(...newSiblings.map(f => f.position)) + 1
        : 0;

      const { error } = await supabase
        .from("chatbot_folders")
        .update({ parent_id: newParentId, position: maxPosition })
        .eq("id", folderId)
        .eq("user_id", userId);

      if (error) throw error;

      setFolders(prev =>
        prev.map(f => f.id === folderId
          ? { ...f, parent_id: newParentId, position: maxPosition }
          : f
        )
      );

      return true;
    } catch (err: any) {
      console.error("[useChatbotFolders] Error moving folder:", err);
      setFoldersError(err.message ?? "Failed to move folder");
      return false;
    }
  }, [userId, folders]);

  const moveChatbot = useCallback(async (chatbotId: string, folderId: string | null): Promise<boolean> => {
    if (!userId) return false;

    try {
      // Get position for the folder's chatbots
      const folderChatbots = chatbots.filter(c => c.folder_id === folderId && c.id !== chatbotId);
      const maxPosition = folderChatbots.length > 0
        ? Math.max(...folderChatbots.map(c => c.position)) + 1
        : 0;

      const { error } = await supabase
        .from("chatbots")
        .update({ folder_id: folderId, position: maxPosition })
        .eq("id", chatbotId)
        .eq("user_id", userId);

      if (error) throw error;

      // Refresh chatbots to update the UI
      if (onChatbotMoved) {
        onChatbotMoved();
      }

      return true;
    } catch (err: any) {
      console.error("[useChatbotFolders] Error moving chatbot:", err);
      setFoldersError(err.message ?? "Failed to move chatbot");
      return false;
    }
  }, [userId, chatbots, onChatbotMoved]);

  const reorderFolders = useCallback(async (
    folderId: string,
    newPosition: number,
    parentId: string | null
  ): Promise<boolean> => {
    if (!userId) return false;

    try {
      // Get all siblings
      const siblings = folders
        .filter(f => f.parent_id === parentId && f.id !== folderId)
        .sort((a, b) => a.position - b.position);

      // Insert at new position
      const folder = folders.find(f => f.id === folderId);
      if (!folder) return false;

      const reorderedSiblings = [...siblings];
      reorderedSiblings.splice(newPosition, 0, folder);

      // Update positions
      const updates = reorderedSiblings.map((f, idx) => ({
        id: f.id,
        position: idx,
      }));

      // Batch update
      await Promise.all(
        updates.map(u =>
          supabase
            .from("chatbot_folders")
            .update({ position: u.position })
            .eq("id", u.id)
            .eq("user_id", userId)
        )
      );

      // Update local state
      setFolders(prev =>
        prev.map(f => {
          const update = updates.find(u => u.id === f.id);
          return update ? { ...f, position: update.position } : f;
        })
      );

      return true;
    } catch (err: any) {
      console.error("[useChatbotFolders] Error reordering folders:", err);
      setFoldersError(err.message ?? "Failed to reorder folders");
      return false;
    }
  }, [userId, folders]);

  const reorderChatbots = useCallback(async (
    chatbotId: string,
    newPosition: number,
    folderId: string | null
  ): Promise<boolean> => {
    if (!userId) return false;

    try {
      // Get all chatbots in the folder
      const folderChatbots = chatbots
        .filter(c => c.folder_id === folderId && c.id !== chatbotId)
        .sort((a, b) => a.position - b.position);

      // Find the chatbot being moved
      const chatbot = chatbots.find(c => c.id === chatbotId);
      if (!chatbot) return false;

      // Insert at new position
      const reorderedChatbots = [...folderChatbots];
      reorderedChatbots.splice(newPosition, 0, chatbot);

      // Update positions
      const updates = reorderedChatbots.map((c, idx) => ({
        id: c.id,
        position: idx,
      }));

      // Batch update
      await Promise.all(
        updates.map(u =>
          supabase
            .from("chatbots")
            .update({ position: u.position })
            .eq("id", u.id)
            .eq("user_id", userId)
        )
      );

      return true;
    } catch (err: any) {
      console.error("[useChatbotFolders] Error reordering chatbots:", err);
      setFoldersError(err.message ?? "Failed to reorder chatbots");
      return false;
    }
  }, [userId, chatbots]);

  const toggleFolderCollapse = useCallback(async (folderId: string): Promise<boolean> => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return false;

    return updateFolder(folderId, { is_collapsed: !folder.is_collapsed });
  }, [folders, updateFolder]);

  const getOrCreateDefaultFolder = useCallback(async (): Promise<string | null> => {
    if (!userId) return null;

    try {
      // First check if we already have a default folder loaded
      const existingDefault = folders.find(f => f.is_default);
      if (existingDefault) return existingDefault.id;

      // Check in database
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
        console.error("[useChatbotFolders] Error creating default folder:", createError);
        return null;
      }

      // Add to local state
      if (newFolder) {
        setFolders(prev => [newFolder, ...prev]);
        return newFolder.id;
      }

      return null;
    } catch (err: any) {
      console.error("[useChatbotFolders] Error getting/creating default folder:", err);
      return null;
    }
  }, [userId, folders]);

  // Get the default folder ID from the loaded folders
  const defaultFolderId = folders.find(f => f.is_default)?.id ?? null;

  return {
    folders,
    folderTree,
    defaultFolderId,
    loadingFolders,
    foldersError,
    createFolder,
    updateFolder,
    deleteFolder,
    moveFolder,
    moveChatbot,
    reorderFolders,
    reorderChatbots,
    toggleFolderCollapse,
    getOrCreateDefaultFolder,
    refreshFolders,
  };
}
