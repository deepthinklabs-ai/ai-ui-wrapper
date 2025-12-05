"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { FolderWithChildren, Thread } from "@/types/chat";
import { FolderItem } from "./FolderItem";
import { ThreadItem } from "./ThreadItem";

type FolderTreeProps = {
  folders: FolderWithChildren[];
  threads: Thread[]; // Threads without folders (root level)
  selectedThreadId: string | null;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => Promise<void>;
  onUpdateThreadTitle: (id: string, newTitle: string) => Promise<void>;
  onCreateFolder: (name: string, parentId?: string | null) => Promise<any>;
  onUpdateFolder: (id: string, updates: { name?: string; color?: string; is_collapsed?: boolean }) => Promise<void>;
  onDeleteFolder: (id: string) => Promise<void>;
  onMoveFolder: (folderId: string, newParentId: string | null) => Promise<void>;
  onMoveThread: (threadId: string, folderId: string | null) => Promise<void>;
  onBulkMoveThreads: (threadIds: string[], folderId: string | null) => Promise<void>;
  onToggleFolderCollapse: (folderId: string) => Promise<void>;
};

type DragItem = {
  type: "folder" | "thread";
  id: string;
};

type DropIndicatorState = {
  folderName: string;
  x: number;
  y: number;
  count?: number;
  itemType?: "folder" | "thread";
} | null;

export function FolderTree({
  folders,
  threads,
  selectedThreadId,
  onSelectThread,
  onDeleteThread,
  onUpdateThreadTitle,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onMoveFolder,
  onMoveThread,
  onBulkMoveThreads,
  onToggleFolderCollapse,
}: FolderTreeProps) {
  const [activeItem, setActiveItem] = useState<DragItem | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  // Multi-select state
  const [multiSelectedIds, setMultiSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedThreadId, setLastClickedThreadId] = useState<string | null>(null);

  // Get all threads in display order (for shift-click range selection)
  const allThreadsInOrder = useMemo((): Thread[] => {
    const result: Thread[] = [];

    const collectFromFolder = (folder: FolderWithChildren) => {
      if (!folder.is_collapsed) {
        folder.threads.forEach(t => result.push(t));
        folder.children.forEach(collectFromFolder);
      }
    };

    folders.forEach(collectFromFolder);
    threads.forEach(t => result.push(t));

    return result;
  }, [folders, threads]);

  // Helper to find folder name by id (recursive)
  const findFolderName = (id: string, folderList: FolderWithChildren[]): string | null => {
    for (const folder of folderList) {
      if (folder.id === id) return folder.name;
      const found = findFolderName(id, folder.children);
      if (found) return found;
    }
    return null;
  };

  // Helper to check if targetId is a descendant of folderId (to prevent circular references)
  const isDescendantOf = (targetId: string, folderId: string, folderList: FolderWithChildren[]): boolean => {
    const findFolder = (id: string, list: FolderWithChildren[]): FolderWithChildren | null => {
      for (const folder of list) {
        if (folder.id === id) return folder;
        const found = findFolder(id, folder.children);
        if (found) return found;
      }
      return null;
    };

    const sourceFolder = findFolder(folderId, folderList);
    if (!sourceFolder) return false;

    const checkDescendants = (folder: FolderWithChildren): boolean => {
      if (folder.id === targetId) return true;
      return folder.children.some(checkDescendants);
    };

    return checkDescendants(sourceFolder);
  };

  // Handle thread multi-select (Ctrl+click or Shift+click)
  const handleThreadMultiSelect = useCallback((threadId: string, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedThreadId) {
      // Shift+click: select range
      const allIds = allThreadsInOrder.map(t => t.id);
      const startIdx = allIds.indexOf(lastClickedThreadId);
      const endIdx = allIds.indexOf(threadId);

      if (startIdx !== -1 && endIdx !== -1) {
        const rangeStart = Math.min(startIdx, endIdx);
        const rangeEnd = Math.max(startIdx, endIdx);
        const rangeIds = allIds.slice(rangeStart, rangeEnd + 1);

        setMultiSelectedIds(prev => {
          const newSet = new Set(prev);
          rangeIds.forEach(id => newSet.add(id));
          return newSet;
        });
      }
    } else if (e.ctrlKey || e.metaKey) {
      // Ctrl+click: toggle individual selection
      setMultiSelectedIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(threadId)) {
          newSet.delete(threadId);
        } else {
          newSet.add(threadId);
        }
        return newSet;
      });
      setLastClickedThreadId(threadId);
    }
  }, [lastClickedThreadId, allThreadsInOrder]);

  // Handle normal thread select (clears multi-selection)
  const handleThreadSelect = useCallback((threadId: string) => {
    setMultiSelectedIds(new Set());
    setLastClickedThreadId(threadId);
    onSelectThread(threadId);
  }, [onSelectThread]);

  // Clear multi-selection when clicking elsewhere
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    // Only clear if clicking on the container itself, not its children
    if (e.target === e.currentTarget) {
      setMultiSelectedIds(new Set());
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    })
  );

  // Focus input when creating folder
  useEffect(() => {
    if (isCreatingFolder && newFolderInputRef.current) {
      newFolderInputRef.current.focus();
    }
  }, [isCreatingFolder]);

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const itemType = active.data.current?.type as "folder" | "thread";
    setActiveItem({
      type: itemType,
      id: active.id as string,
    });
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over, active } = event;
    const newOverId = over?.id as string | null;
    setOverId(newOverId);

    const activeType = active.data.current?.type as "folder" | "thread";
    const overType = over?.data.current?.type as "folder" | "thread" | "root" | undefined;

    // Get mouse position for drop indicator
    const getMousePosition = () => {
      const activatorEvent = event.activatorEvent as MouseEvent | TouchEvent;
      let x = 0, y = 0;
      if (activatorEvent instanceof MouseEvent) {
        x = activatorEvent.clientX;
        y = activatorEvent.clientY;
      } else if (activatorEvent instanceof TouchEvent && activatorEvent.touches[0]) {
        x = activatorEvent.touches[0].clientX;
        y = activatorEvent.touches[0].clientY;
      }
      if (event.delta) {
        x += event.delta.x;
        y += event.delta.y;
      }
      return { x, y };
    };

    // Show indicator when dragging a thread over a folder
    if (activeType === "thread" && overType === "folder" && newOverId) {
      const folderName = findFolderName(newOverId, folders);
      if (folderName) {
        const { x, y } = getMousePosition();

        // Check if dragging multiple selected threads
        const activeThreadId = active.id as string;
        const isDraggingMultiple = multiSelectedIds.has(activeThreadId) && multiSelectedIds.size > 1;
        const displayName = isDraggingMultiple
          ? `${multiSelectedIds.size} threads`
          : folderName;

        setDropIndicator({ folderName: displayName, x, y, count: isDraggingMultiple ? multiSelectedIds.size : 1, itemType: "thread" });
      } else {
        setDropIndicator(null);
      }
    }
    // Show indicator when dragging a folder over another folder
    else if (activeType === "folder" && overType === "folder" && newOverId && active.id !== newOverId) {
      const activeFolderId = active.id as string;

      // Prevent dropping folder into itself or its descendants
      if (isDescendantOf(newOverId, activeFolderId, folders)) {
        setDropIndicator(null);
        return;
      }

      const targetFolderName = findFolderName(newOverId, folders);
      const sourceFolderName = findFolderName(activeFolderId, folders);
      if (targetFolderName && sourceFolderName) {
        const { x, y } = getMousePosition();
        setDropIndicator({ folderName: targetFolderName, x, y, itemType: "folder" });
      } else {
        setDropIndicator(null);
      }
    } else {
      setDropIndicator(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveItem(null);
    setOverId(null);
    setDropIndicator(null);

    if (!over) return;

    const activeType = active.data.current?.type as "folder" | "thread";
    const overType = over.data.current?.type as "folder" | "thread" | "root";
    const targetFolderId = over.id as string;

    if (activeType === "thread") {
      const activeThreadId = active.id as string;

      // Check if we're moving multiple selected threads
      const isPartOfMultiSelect = multiSelectedIds.has(activeThreadId) && multiSelectedIds.size > 1;

      if (overType === "folder") {
        if (isPartOfMultiSelect) {
          // Bulk move all selected threads
          await onBulkMoveThreads(Array.from(multiSelectedIds), targetFolderId);
          setMultiSelectedIds(new Set()); // Clear selection after move
        } else {
          // Single thread move
          await onMoveThread(activeThreadId, targetFolderId);
        }
      } else if (overType === "root") {
        if (isPartOfMultiSelect) {
          // Bulk move all selected threads to root
          await onBulkMoveThreads(Array.from(multiSelectedIds), null);
          setMultiSelectedIds(new Set());
        } else {
          await onMoveThread(activeThreadId, null);
        }
      }
    } else if (activeType === "folder") {
      const activeFolderId = active.id as string;
      // Moving a folder
      if (overType === "folder" && active.id !== over.id) {
        // Prevent dropping folder into itself or its descendants
        if (isDescendantOf(targetFolderId, activeFolderId, folders)) {
          return; // Don't allow circular reference
        }
        // Drop folder into another folder
        await onMoveFolder(activeFolderId, targetFolderId);
      } else if (overType === "root") {
        // Drop folder to root level
        await onMoveFolder(activeFolderId, null);
      }
    }
  };

  const handleCreateFolder = async (parentId: string | null = null) => {
    setNewFolderParentId(parentId);
    setIsCreatingFolder(true);
    setNewFolderName("");
  };

  const handleSaveNewFolder = async () => {
    const trimmedName = newFolderName.trim();
    if (!trimmedName) {
      setIsCreatingFolder(false);
      return;
    }

    await onCreateFolder(trimmedName, newFolderParentId);
    setIsCreatingFolder(false);
    setNewFolderName("");
    setNewFolderParentId(null);
  };

  const handleCancelNewFolder = () => {
    setIsCreatingFolder(false);
    setNewFolderName("");
    setNewFolderParentId(null);
  };

  const handleNewFolderKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveNewFolder();
    } else if (e.key === "Escape") {
      handleCancelNewFolder();
    }
  };

  // Get all folder and thread IDs for sortable context
  const getAllIds = (): string[] => {
    const ids: string[] = [];

    const collectIds = (folder: FolderWithChildren) => {
      ids.push(folder.id);
      folder.threads.forEach(t => ids.push(t.id));
      folder.children.forEach(collectIds);
    };

    folders.forEach(collectIds);
    threads.forEach(t => ids.push(t.id));

    return ids;
  };

  // Find the active folder or thread for the drag overlay
  const findActiveFolder = (id: string, folders: FolderWithChildren[]): FolderWithChildren | null => {
    for (const folder of folders) {
      if (folder.id === id) return folder;
      const found = findActiveFolder(id, folder.children);
      if (found) return found;
    }
    return null;
  };

  const findActiveThread = (id: string, folders: FolderWithChildren[], rootThreads: Thread[]): Thread | null => {
    // Check root threads
    const rootThread = rootThreads.find(t => t.id === id);
    if (rootThread) return rootThread;

    // Check folder threads recursively
    const searchFolders = (folders: FolderWithChildren[]): Thread | null => {
      for (const folder of folders) {
        const thread = folder.threads.find(t => t.id === id);
        if (thread) return thread;
        const found = searchFolders(folder.children);
        if (found) return found;
      }
      return null;
    };

    return searchFolders(folders);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col">
        {/* New Folder Button */}
        <button
          type="button"
          onClick={() => handleCreateFolder(null)}
          className="mb-2 flex items-center gap-2 px-2 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 rounded-md transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            />
          </svg>
          New Folder
        </button>

        {/* New Folder Input (at root level) */}
        {isCreatingFolder && newFolderParentId === null && (
          <div className="mb-2 flex items-center gap-1 px-2 py-1">
            <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            <input
              ref={newFolderInputRef}
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={handleNewFolderKeyDown}
              onBlur={handleSaveNewFolder}
              placeholder="Folder name"
              className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-100 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>
        )}

        {/* Root Drop Zone */}
        <div
          data-droppable="root"
          className={`min-h-[2px] rounded transition-colors ${
            overId === "root" ? "bg-blue-500/30" : ""
          }`}
        />

        <SortableContext items={getAllIds()} strategy={verticalListSortingStrategy}>
          {/* Render folders */}
          {folders.map((folder) => (
            <FolderItem
              key={folder.id}
              folder={folder}
              depth={0}
              selectedThreadId={selectedThreadId}
              onSelectThread={handleThreadSelect}
              onDeleteThread={onDeleteThread}
              onUpdateThreadTitle={onUpdateThreadTitle}
              onUpdateFolder={onUpdateFolder}
              onDeleteFolder={onDeleteFolder}
              onToggleFolderCollapse={onToggleFolderCollapse}
              onCreateSubfolder={handleCreateFolder}
              isOver={overId === folder.id}
              isCreatingSubfolder={isCreatingFolder && newFolderParentId === folder.id}
              newFolderName={newFolderName}
              onNewFolderNameChange={setNewFolderName}
              onNewFolderKeyDown={handleNewFolderKeyDown}
              onNewFolderBlur={handleSaveNewFolder}
              newFolderInputRef={newFolderInputRef}
              multiSelectedIds={multiSelectedIds}
              onThreadMultiSelect={handleThreadMultiSelect}
            />
          ))}

          {/* Render root-level threads (without folder) */}
          {threads.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              isSelected={thread.id === selectedThreadId}
              isMultiSelected={multiSelectedIds.has(thread.id)}
              onSelect={() => handleThreadSelect(thread.id)}
              onMultiSelect={(e) => handleThreadMultiSelect(thread.id, e)}
              onDelete={() => onDeleteThread(thread.id)}
              onUpdateTitle={(newTitle) => onUpdateThreadTitle(thread.id, newTitle)}
              depth={0}
            />
          ))}
        </SortableContext>

        {/* Empty state */}
        {folders.length === 0 && threads.length === 0 && !isCreatingFolder && (
          <div className="px-2 py-3 text-xs text-slate-500 text-center">
            No threads yet. Create one to get started.
          </div>
        )}
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeItem && activeItem.type === "folder" && (
          <div className="rounded-md bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200 shadow-lg">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                />
              </svg>
              {findActiveFolder(activeItem.id, folders)?.name || "Folder"}
            </div>
          </div>
        )}
        {activeItem && activeItem.type === "thread" && (
          <div className="rounded-md bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200 shadow-lg">
            {multiSelectedIds.has(activeItem.id) && multiSelectedIds.size > 1 ? (
              <div className="flex items-center gap-2">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 text-xs font-bold">
                  {multiSelectedIds.size}
                </span>
                <span>{multiSelectedIds.size} threads selected</span>
              </div>
            ) : (
              findActiveThread(activeItem.id, folders, threads)?.title || "Thread"
            )}
          </div>
        )}
      </DragOverlay>

      {/* Drop Indicator Tooltip */}
      {dropIndicator && (
        <div
          className="fixed z-[9999] pointer-events-none px-3 py-1.5 rounded-md bg-blue-600 text-white text-sm font-medium shadow-lg whitespace-nowrap"
          style={{
            left: dropIndicator.x + 20,
            top: dropIndicator.y - 10,
          }}
        >
          <div className="flex items-center gap-1.5">
            {dropIndicator.itemType === "folder" ? (
              <>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                Move into "{dropIndicator.folderName}"
              </>
            ) : (
              <>
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                {dropIndicator.count && dropIndicator.count > 1
                  ? `Move ${dropIndicator.count} threads to "${dropIndicator.folderName}"`
                  : `Add to "${dropIndicator.folderName}"`
                }
              </>
            )}
          </div>
        </div>
      )}
    </DndContext>
  );
}
