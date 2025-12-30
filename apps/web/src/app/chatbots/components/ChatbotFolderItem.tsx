"use client";

/**
 * ChatbotFolderItem Component
 *
 * Displays a folder in the chatbot sidebar with drag-and-drop support.
 * Similar to FolderItem but for chatbot organization.
 */

import React, { useState, useRef, useEffect } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { ChatbotFolderWithChildren } from "@/types/chatbot";
import { ChatbotItem } from "./ChatbotItem";

type ChatbotFolderItemProps = {
  folder: ChatbotFolderWithChildren;
  depth: number;
  selectedChatbotId: string | null;
  onSelectChatbot: (id: string) => void;
  onDeleteChatbot: (id: string) => Promise<void>;
  onRenameChatbot: (id: string, newName: string) => Promise<void>;
  onUpdateFolder: (id: string, updates: { name?: string; color?: string; is_collapsed?: boolean }) => Promise<boolean | void>;
  onDeleteFolder: (id: string) => Promise<boolean | void>;
  onToggleFolderCollapse: (folderId: string) => Promise<boolean | void>;
  onCreateSubfolder: (parentId: string) => void;
  isOver?: boolean;
  isCreatingSubfolder?: boolean;
  newFolderName?: string;
  onNewFolderNameChange?: (name: string) => void;
  onNewFolderKeyDown?: (e: React.KeyboardEvent) => void;
  onNewFolderBlur?: () => void;
  newFolderInputRef?: React.RefObject<HTMLInputElement | null>;
  onStartChatbotThread?: (chatbotId: string, chatbotName: string) => void;
  onEditChatbot?: (id: string) => void;
  onDuplicateChatbot?: (id: string) => void;
  onExportChatbot?: (id: string) => void;
};

export function ChatbotFolderItem({
  folder,
  depth,
  selectedChatbotId,
  onSelectChatbot,
  onDeleteChatbot,
  onRenameChatbot,
  onUpdateFolder,
  onDeleteFolder,
  onToggleFolderCollapse,
  onCreateSubfolder,
  isOver,
  isCreatingSubfolder,
  newFolderName,
  onNewFolderNameChange,
  onNewFolderKeyDown,
  onNewFolderBlur,
  newFolderInputRef,
  onStartChatbotThread,
  onEditChatbot,
  onDuplicateChatbot,
  onExportChatbot,
}: ChatbotFolderItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(folder.name);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const editInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const { setNodeRef: setDroppableRef, isOver: isDroppableOver } = useDroppable({
    id: folder.id,
    data: {
      type: "folder",
      folder,
    },
  });

  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
    isDragging,
  } = useDraggable({
    id: folder.id,
    data: {
      type: "folder",
      folder,
    },
  });

  // Combine both refs
  const setNodeRef = (node: HTMLElement | null) => {
    setDroppableRef(node);
    setDraggableRef(node);
  };

  const showDropHighlight = isOver || isDroppableOver;

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setShowContextMenu(false);
      }
    };

    if (showContextMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showContextMenu]);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  };

  const handleStartEdit = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShowContextMenu(false);
    setEditedName(folder.name);
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    const trimmedName = editedName.trim();
    if (trimmedName && trimmedName !== folder.name) {
      await onUpdateFolder(folder.id, { name: trimmedName });
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditedName(folder.name);
    }
  };

  const handleDelete = async () => {
    setShowContextMenu(false);
    const hasContent = folder.children.length > 0 || folder.chatbots.length > 0;
    const message = hasContent
      ? `Delete "${folder.name}" and all its contents?\n\nThis folder contains ${folder.chatbots.length} chatbot(s) and ${folder.children.length} subfolder(s). Chatbots will be moved to the root level.`
      : `Delete "${folder.name}"?`;

    if (window.confirm(message)) {
      await onDeleteFolder(folder.id);
    }
  };

  const handleCreateSubfolder = () => {
    setShowContextMenu(false);
    onCreateSubfolder(folder.id);
  };

  const paddingLeft = depth * 12 + 8;

  return (
    <div ref={setNodeRef} style={style}>
      {/* Folder Header */}
      <div
        onContextMenu={handleContextMenu}
        className={`group flex items-center gap-1 rounded-md px-2 py-1.5 transition-colors cursor-grab active:cursor-grabbing ${
          showDropHighlight ? "bg-sky/20 ring-2 ring-sky/50" : "hover:bg-white/40"
        } ${isDragging ? "z-50" : ""}`}
        style={{ paddingLeft }}
        {...attributes}
        {...listeners}
      >
        {/* Collapse/Expand Arrow */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFolderCollapse(folder.id);
          }}
          className="flex-shrink-0 p-0.5 text-foreground/50 hover:text-foreground"
        >
          <svg
            className={`h-3 w-3 transition-transform ${folder.is_collapsed ? "" : "rotate-90"}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Folder Icon */}
        <svg
          className={`h-4 w-4 flex-shrink-0 ${
            folder.color ? "" : "text-amber-400"
          }`}
          style={folder.color ? { color: folder.color } : undefined}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>

        {/* Folder Name */}
        {isEditing ? (
          <input
            ref={editInputRef}
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSaveEdit}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 rounded border border-white/40 bg-white/60 px-1.5 py-0.5 text-sm text-foreground focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky"
          />
        ) : (
          <span
            className="flex-1 truncate text-sm text-foreground"
            onDoubleClick={handleStartEdit}
          >
            {folder.name}
          </span>
        )}

        {/* Quick Actions (visible on hover) */}
        {!isEditing && (
          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={handleCreateSubfolder}
              className="rounded p-1 hover:bg-white/40 text-foreground/50 hover:text-foreground"
              title="Create subfolder"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleStartEdit}
              className="rounded p-1 hover:bg-white/40 text-foreground/40 hover:text-sky"
              title="Rename folder"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded p-1 hover:bg-white/40 text-foreground/40 hover:text-red-400"
              title="Delete folder"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        )}

        {/* Chatbot count badge */}
        {folder.chatbots.length > 0 && (
          <span className="text-xs text-foreground/50 tabular-nums">
            {folder.chatbots.length}
          </span>
        )}
      </div>

      {/* Context Menu */}
      {showContextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 rounded-md border border-white/40 bg-white/80 backdrop-blur-md shadow-lg py-1 min-w-[160px]"
          style={{ left: contextMenuPos.x, top: contextMenuPos.y }}
        >
          <button
            onClick={handleCreateSubfolder}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-white/40"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Subfolder
          </button>
          <button
            onClick={handleStartEdit}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground hover:bg-white/40"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
            </svg>
            Rename
          </button>
          <div className="my-1 border-t border-white/40" />
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-400 hover:bg-white/40"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            Delete
          </button>
        </div>
      )}

      {/* Folder Contents (when not collapsed) */}
      {!folder.is_collapsed && (
        <div>
          {/* New subfolder input */}
          {isCreatingSubfolder && (
            <div
              className="flex items-center gap-1 px-2 py-1"
              style={{ paddingLeft: paddingLeft + 24 }}
            >
              <svg className="h-4 w-4 text-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                value={newFolderName || ""}
                onChange={(e) => onNewFolderNameChange?.(e.target.value)}
                onKeyDown={onNewFolderKeyDown}
                onBlur={onNewFolderBlur}
                placeholder="Folder name"
                className="flex-1 rounded border border-white/40 bg-white/60 px-2 py-1 text-sm text-foreground focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky"
              />
            </div>
          )}

          {/* Child folders */}
          {folder.children.map((child) => (
            <ChatbotFolderItem
              key={child.id}
              folder={child}
              depth={depth + 1}
              selectedChatbotId={selectedChatbotId}
              onSelectChatbot={onSelectChatbot}
              onDeleteChatbot={onDeleteChatbot}
              onRenameChatbot={onRenameChatbot}
              onUpdateFolder={onUpdateFolder}
              onDeleteFolder={onDeleteFolder}
              onToggleFolderCollapse={onToggleFolderCollapse}
              onCreateSubfolder={onCreateSubfolder}
              isCreatingSubfolder={isCreatingSubfolder}
              newFolderName={newFolderName}
              onNewFolderNameChange={onNewFolderNameChange}
              onNewFolderKeyDown={onNewFolderKeyDown}
              onNewFolderBlur={onNewFolderBlur}
              newFolderInputRef={newFolderInputRef}
              onStartChatbotThread={onStartChatbotThread}
              onEditChatbot={onEditChatbot}
              onDuplicateChatbot={onDuplicateChatbot}
              onExportChatbot={onExportChatbot}
            />
          ))}

          {/* Chatbots in this folder */}
          {folder.chatbots.map((chatbot) => (
            <ChatbotItem
              key={chatbot.id}
              chatbot={chatbot}
              isSelected={chatbot.id === selectedChatbotId}
              onClick={() => onSelectChatbot(chatbot.id)}
              onStartThread={onStartChatbotThread ? () => onStartChatbotThread(chatbot.id, chatbot.name) : undefined}
              onEdit={onEditChatbot ? () => onEditChatbot(chatbot.id) : undefined}
              onDuplicate={onDuplicateChatbot ? () => onDuplicateChatbot(chatbot.id) : undefined}
              onExport={onExportChatbot ? () => onExportChatbot(chatbot.id) : undefined}
              onDelete={() => onDeleteChatbot(chatbot.id)}
              onRename={(newName) => onRenameChatbot(chatbot.id, newName)}
              depth={depth + 1}
              isDraggable
            />
          ))}
        </div>
      )}
    </div>
  );
}
