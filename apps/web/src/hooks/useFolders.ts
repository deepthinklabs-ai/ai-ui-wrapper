"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Folder, FolderWithChildren, Thread } from "@/types/chat";

type UseFoldersResult = {
  folders: Folder[];
  folderTree: FolderWithChildren[];
  loadingFolders: boolean;
  foldersError: string | null;
  createFolder: (name: string, parentId?: string | null) => Promise<Folder | null>;
  updateFolder: (id: string, updates: Partial<Pick<Folder, 'name' | 'color' | 'icon' | 'is_collapsed'>>) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  moveFolder: (folderId: string, newParentId: string | null) => Promise<void>;
  moveThread: (threadId: string, folderId: string | null) => Promise<void>;
  reorderFolders: (folderId: string, newPosition: number, parentId: string | null) => Promise<void>;
  reorderThreads: (threadId: string, newPosition: number, folderId: string | null) => Promise<void>;
  toggleFolderCollapse: (folderId: string) => Promise<void>;
  refreshFolders: () => Promise<void>;
};

/**
 * Build a tree structure from flat folder list
 */
function buildFolderTree(folders: Folder[], threads: Thread[]): FolderWithChildren[] {
  // Create a map for quick lookup
  const folderMap = new Map<string, FolderWithChildren>();

  // Initialize all folders with empty children and threads
  folders.forEach(folder => {
    folderMap.set(folder.id, {
      ...folder,
      children: [],
      threads: [],
    });
  });

  // Assign threads to their folders
  threads.forEach(thread => {
    if (thread.folder_id && folderMap.has(thread.folder_id)) {
      folderMap.get(thread.folder_id)!.threads.push(thread);
    }
  });

  // Sort threads within each folder by position
  folderMap.forEach(folder => {
    folder.threads.sort((a, b) => a.position - b.position);
  });

  // Build tree structure
  const rootFolders: FolderWithChildren[] = [];

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
  const sortChildren = (folder: FolderWithChildren) => {
    folder.children.sort((a, b) => a.position - b.position);
    folder.children.forEach(sortChildren);
  };

  rootFolders.sort((a, b) => a.position - b.position);
  rootFolders.forEach(sortChildren);

  return rootFolders;
}

type UseFoldersOptions = {
  onThreadMoved?: () => void; // Callback to refresh threads after move
};

export function useFolders(
  userId: string | null | undefined,
  threads: Thread[],
  options: UseFoldersOptions = {}
): UseFoldersResult {
  const { onThreadMoved } = options;
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [foldersError, setFoldersError] = useState<string | null>(null);

  // Build tree structure whenever folders or threads change
  const folderTree = buildFolderTree(folders, threads);

  const refreshFolders = useCallback(async () => {
    if (!userId) return;
    setLoadingFolders(true);
    setFoldersError(null);

    try {
      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .eq("user_id", userId)
        .order("position", { ascending: true });

      if (error) throw error;
      setFolders(data ?? []);
    } catch (err: any) {
      setFoldersError(err.message ?? "Failed to load folders");
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

  const createFolder = async (name: string, parentId: string | null = null): Promise<Folder | null> => {
    if (!userId) return null;

    try {
      // Get the highest position among siblings to add at the end
      const siblings = folders.filter(f => f.parent_id === parentId);
      const maxPosition = siblings.length > 0
        ? Math.max(...siblings.map(f => f.position)) + 1
        : 0;

      const { data, error } = await supabase
        .from("folders")
        .insert({
          user_id: userId,
          parent_id: parentId,
          name,
          position: maxPosition,
        })
        .select()
        .single();

      if (error) throw error;
      if (!data) return null;

      setFolders(prev => [...prev, data]);
      return data;
    } catch (err: any) {
      console.error("Error creating folder:", err);
      setFoldersError(err.message ?? "Failed to create folder");
      return null;
    }
  };

  const updateFolder = async (
    id: string,
    updates: Partial<Pick<Folder, 'name' | 'color' | 'icon' | 'is_collapsed'>>
  ): Promise<void> => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("folders")
        .update(updates)
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;

      setFolders(prev =>
        prev.map(f => f.id === id ? { ...f, ...updates } : f)
      );
    } catch (err: any) {
      console.error("Error updating folder:", err);
      setFoldersError(err.message ?? "Failed to update folder");
    }
  };

  const deleteFolder = async (id: string): Promise<void> => {
    if (!userId) return;

    try {
      const { error } = await supabase
        .from("folders")
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
    } catch (err: any) {
      console.error("Error deleting folder:", err);
      setFoldersError(err.message ?? "Failed to delete folder");
    }
  };

  const moveFolder = async (folderId: string, newParentId: string | null): Promise<void> => {
    if (!userId) return;

    try {
      // Get position for new parent's children
      const newSiblings = folders.filter(f => f.parent_id === newParentId && f.id !== folderId);
      const maxPosition = newSiblings.length > 0
        ? Math.max(...newSiblings.map(f => f.position)) + 1
        : 0;

      const { error } = await supabase
        .from("folders")
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
    } catch (err: any) {
      console.error("Error moving folder:", err);
      setFoldersError(err.message ?? "Failed to move folder");
    }
  };

  const moveThread = async (threadId: string, folderId: string | null): Promise<void> => {
    if (!userId) return;

    try {
      // Get position for the folder's threads
      const folderThreads = threads.filter(t => t.folder_id === folderId && t.id !== threadId);
      const maxPosition = folderThreads.length > 0
        ? Math.max(...folderThreads.map(t => t.position)) + 1
        : 0;

      const { error } = await supabase
        .from("threads")
        .update({ folder_id: folderId, position: maxPosition })
        .eq("id", threadId)
        .eq("user_id", userId);

      if (error) {
        console.error("Supabase error moving thread:", error.message, error.details, error.hint);
        throw new Error(error.message || "Database error");
      }

      // Refresh threads to update the UI
      if (onThreadMoved) {
        onThreadMoved();
      }
    } catch (err: any) {
      console.error("Error moving thread:", err?.message || err);
      setFoldersError(err?.message ?? "Failed to move thread");
    }
  };

  const reorderFolders = async (
    folderId: string,
    newPosition: number,
    parentId: string | null
  ): Promise<void> => {
    if (!userId) return;

    try {
      // Get all siblings
      const siblings = folders
        .filter(f => f.parent_id === parentId && f.id !== folderId)
        .sort((a, b) => a.position - b.position);

      // Insert at new position
      const folder = folders.find(f => f.id === folderId);
      if (!folder) return;

      const reorderedSiblings = [...siblings];
      reorderedSiblings.splice(newPosition, 0, folder);

      // Update positions
      const updates = reorderedSiblings.map((f, idx) => ({
        id: f.id,
        position: idx,
      }));

      // Batch update (in parallel)
      await Promise.all(
        updates.map(u =>
          supabase
            .from("folders")
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
    } catch (err: any) {
      console.error("Error reordering folders:", err);
      setFoldersError(err.message ?? "Failed to reorder folders");
    }
  };

  const reorderThreads = async (
    threadId: string,
    newPosition: number,
    folderId: string | null
  ): Promise<void> => {
    if (!userId) return;

    try {
      // Get all threads in the folder
      const folderThreads = threads
        .filter(t => t.folder_id === folderId && t.id !== threadId)
        .sort((a, b) => a.position - b.position);

      // Find the thread being moved
      const thread = threads.find(t => t.id === threadId);
      if (!thread) return;

      // Insert at new position
      const reorderedThreads = [...folderThreads];
      reorderedThreads.splice(newPosition, 0, thread);

      // Update positions
      const updates = reorderedThreads.map((t, idx) => ({
        id: t.id,
        position: idx,
      }));

      // Batch update
      await Promise.all(
        updates.map(u =>
          supabase
            .from("threads")
            .update({ position: u.position })
            .eq("id", u.id)
            .eq("user_id", userId)
        )
      );

      // Note: Thread state is managed by useThreads
    } catch (err: any) {
      console.error("Error reordering threads:", err);
      setFoldersError(err.message ?? "Failed to reorder threads");
    }
  };

  const toggleFolderCollapse = async (folderId: string): Promise<void> => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    await updateFolder(folderId, { is_collapsed: !folder.is_collapsed });
  };

  return {
    folders,
    folderTree,
    loadingFolders,
    foldersError,
    createFolder,
    updateFolder,
    deleteFolder,
    moveFolder,
    moveThread,
    reorderFolders,
    reorderThreads,
    toggleFolderCollapse,
    refreshFolders,
  };
}
