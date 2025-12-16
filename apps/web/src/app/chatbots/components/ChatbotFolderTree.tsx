"use client";

/**
 * ChatbotFolderTree Component
 *
 * Displays chatbot folders and chatbots in a tree structure with drag-and-drop support.
 * Similar to FolderTree but for chatbot organization.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Chatbot, ChatbotFolderWithChildren } from "@/types/chatbot";
import { ChatbotFolderItem } from "./ChatbotFolderItem";
import { ChatbotItem } from "./ChatbotItem";

type ChatbotFolderTreeProps = {
  folders: ChatbotFolderWithChildren[];
  chatbots: Chatbot[]; // Root-level chatbots (without folders)
  selectedChatbotId: string | null;
  onSelectChatbot: (id: string) => void;
  onDeleteChatbot: (id: string) => Promise<void>;
  onRenameChatbot: (id: string, newName: string) => Promise<void>;
  onCreateFolder: (input: { name: string; parent_id?: string | null }) => Promise<any>;
  onUpdateFolder: (id: string, updates: { name?: string; color?: string; is_collapsed?: boolean }) => Promise<boolean | void>;
  onDeleteFolder: (id: string) => Promise<boolean | void>;
  onMoveFolder: (folderId: string, newParentId: string | null) => Promise<boolean | void>;
  onMoveChatbot: (chatbotId: string, folderId: string | null) => Promise<boolean | void>;
  onToggleFolderCollapse: (folderId: string) => Promise<boolean | void>;
  onStartChatbotThread?: (chatbotId: string, chatbotName: string) => void;
  onDuplicateChatbot?: (id: string) => void;
  onExportChatbot?: (id: string) => void;
};

type DragItem = {
  type: "folder" | "chatbot";
  id: string;
};

type DropIndicatorState = {
  folderName: string;
  x: number;
  y: number;
  itemType?: "folder" | "chatbot";
} | null;

export function ChatbotFolderTree({
  folders,
  chatbots,
  selectedChatbotId,
  onSelectChatbot,
  onDeleteChatbot,
  onRenameChatbot,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder,
  onMoveFolder,
  onMoveChatbot,
  onToggleFolderCollapse,
  onStartChatbotThread,
  onDuplicateChatbot,
  onExportChatbot,
}: ChatbotFolderTreeProps) {
  const [activeItem, setActiveItem] = useState<DragItem | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<DropIndicatorState>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState<string | null>(null);
  const newFolderInputRef = useRef<HTMLInputElement>(null);

  // Helper to find folder name by id (recursive)
  const findFolderName = (id: string, folderList: ChatbotFolderWithChildren[]): string | null => {
    for (const folder of folderList) {
      if (folder.id === id) return folder.name;
      const found = findFolderName(id, folder.children);
      if (found) return found;
    }
    return null;
  };

  // Helper to check if targetId is a descendant of folderId
  const isDescendantOf = (targetId: string, folderId: string, folderList: ChatbotFolderWithChildren[]): boolean => {
    const findFolder = (id: string, list: ChatbotFolderWithChildren[]): ChatbotFolderWithChildren | null => {
      for (const folder of list) {
        if (folder.id === id) return folder;
        const found = findFolder(id, folder.children);
        if (found) return found;
      }
      return null;
    };

    const sourceFolder = findFolder(folderId, folderList);
    if (!sourceFolder) return false;

    const checkDescendants = (folder: ChatbotFolderWithChildren): boolean => {
      if (folder.id === targetId) return true;
      return folder.children.some(checkDescendants);
    };

    return checkDescendants(sourceFolder);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
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
    const itemType = active.data.current?.type as "folder" | "chatbot";
    setActiveItem({
      type: itemType,
      id: active.id as string,
    });
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over, active } = event;
    const newOverId = over?.id as string | null;
    setOverId(newOverId);

    const activeType = active.data.current?.type as "folder" | "chatbot";
    const overType = over?.data.current?.type as "folder" | "chatbot" | "root" | undefined;

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

    // Show indicator when dragging a chatbot over a folder
    if (activeType === "chatbot" && overType === "folder" && newOverId) {
      const folderName = findFolderName(newOverId, folders);
      if (folderName) {
        const { x, y } = getMousePosition();
        setDropIndicator({ folderName, x, y, itemType: "chatbot" });
      } else {
        setDropIndicator(null);
      }
    }
    // Show indicator when dragging a folder over another folder
    else if (activeType === "folder" && overType === "folder" && newOverId && active.id !== newOverId) {
      const activeFolderId = active.id as string;

      if (isDescendantOf(newOverId, activeFolderId, folders)) {
        setDropIndicator(null);
        return;
      }

      const targetFolderName = findFolderName(newOverId, folders);
      if (targetFolderName) {
        const { x, y } = getMousePosition();
        setDropIndicator({ folderName: targetFolderName, x, y, itemType: "folder" });
      } else {
        setDropIndicator(null);
      }
    }
    else if (overType === "root" || newOverId === "root") {
      setDropIndicator(null);
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

    const activeType = active.data.current?.type as "folder" | "chatbot";
    const overType = over.data.current?.type as "folder" | "chatbot" | "root";
    const targetFolderId = over.id as string;

    const isRootTarget = overType === "root" || over.id === "root";

    if (activeType === "chatbot") {
      const activeChatbotId = active.id as string;
      if (overType === "folder") {
        await onMoveChatbot(activeChatbotId, targetFolderId);
      } else if (isRootTarget) {
        await onMoveChatbot(activeChatbotId, null);
      }
    } else if (activeType === "folder") {
      const activeFolderId = active.id as string;
      if (overType === "folder" && active.id !== over.id) {
        if (isDescendantOf(targetFolderId, activeFolderId, folders)) {
          return;
        }
        await onMoveFolder(activeFolderId, targetFolderId);
      } else if (isRootTarget) {
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

    await onCreateFolder({ name: trimmedName, parent_id: newFolderParentId });
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

  // Get all folder and chatbot IDs for sortable context
  const getAllIds = (): string[] => {
    const ids: string[] = [];

    const collectIds = (folder: ChatbotFolderWithChildren) => {
      ids.push(folder.id);
      folder.chatbots.forEach(c => ids.push(c.id));
      folder.children.forEach(collectIds);
    };

    folders.forEach(collectIds);
    chatbots.forEach(c => ids.push(c.id));

    return ids;
  };

  // Find the active folder for the drag overlay
  const findActiveFolder = (id: string, folders: ChatbotFolderWithChildren[]): ChatbotFolderWithChildren | null => {
    for (const folder of folders) {
      if (folder.id === id) return folder;
      const found = findActiveFolder(id, folder.children);
      if (found) return found;
    }
    return null;
  };

  // Find the active chatbot for the drag overlay
  const findActiveChatbot = (id: string, folders: ChatbotFolderWithChildren[], rootChatbots: Chatbot[]): Chatbot | null => {
    const rootChatbot = rootChatbots.find(c => c.id === id);
    if (rootChatbot) return rootChatbot;

    const searchFolders = (folders: ChatbotFolderWithChildren[]): Chatbot | null => {
      for (const folder of folders) {
        const chatbot = folder.chatbots.find(c => c.id === id);
        if (chatbot) return chatbot;
        const found = searchFolders(folder.children);
        if (found) return found;
      }
      return null;
    };

    return searchFolders(folders);
  };

  // Root container droppable
  const { setNodeRef: setRootRef } = useDroppable({
    id: "root",
    data: {
      type: "root",
    },
  });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div ref={setRootRef} className="flex flex-col min-h-[100px]">
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
          + New Folder
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

        <SortableContext items={getAllIds()} strategy={verticalListSortingStrategy}>
          {/* Render folders */}
          {folders.map((folder) => (
            <ChatbotFolderItem
              key={folder.id}
              folder={folder}
              depth={0}
              selectedChatbotId={selectedChatbotId}
              onSelectChatbot={onSelectChatbot}
              onDeleteChatbot={onDeleteChatbot}
              onRenameChatbot={onRenameChatbot}
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
              onStartChatbotThread={onStartChatbotThread}
              onDuplicateChatbot={onDuplicateChatbot}
              onExportChatbot={onExportChatbot}
            />
          ))}

          {/* Render root-level chatbots (without folder) */}
          {chatbots.map((chatbot) => (
            <ChatbotItem
              key={chatbot.id}
              chatbot={chatbot}
              isSelected={chatbot.id === selectedChatbotId}
              onClick={() => onSelectChatbot(chatbot.id)}
              onStartThread={onStartChatbotThread ? () => onStartChatbotThread(chatbot.id, chatbot.name) : undefined}
              onDuplicate={onDuplicateChatbot ? () => onDuplicateChatbot(chatbot.id) : undefined}
              onExport={onExportChatbot ? () => onExportChatbot(chatbot.id) : undefined}
              onDelete={() => onDeleteChatbot(chatbot.id)}
              onRename={(newName) => onRenameChatbot(chatbot.id, newName)}
              depth={0}
              isDraggable
            />
          ))}
        </SortableContext>

        {/* Empty state */}
        {folders.length === 0 && chatbots.length === 0 && !isCreatingFolder && (
          <div className="px-2 py-3 text-xs text-slate-500 text-center">
            No chatbots yet. Create one to get started.
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
        {activeItem && activeItem.type === "chatbot" && (
          <div className="rounded-md bg-slate-800 border border-slate-600 px-3 py-2 text-sm text-slate-200 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-slate-500" />
              {findActiveChatbot(activeItem.id, folders, chatbots)?.name || "Chatbot"}.chatbot
            </div>
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
                Add to "{dropIndicator.folderName}"
              </>
            )}
          </div>
        </div>
      )}
    </DndContext>
  );
}
