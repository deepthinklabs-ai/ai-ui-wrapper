"use client";

/**
 * ChatbotItem Component
 *
 * Individual chatbot item for the sidebar list.
 * Shows chatbot name with .chatbot extension, model provider indicator, and action buttons.
 * Supports drag-and-drop for organization.
 */

import React, { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Chatbot } from "@/types/chatbot";

type ChatbotItemProps = {
  /** The chatbot to display */
  chatbot: Chatbot;
  /** Whether this chatbot is selected */
  isSelected: boolean;
  /** Called when the chatbot is clicked */
  onClick: () => void;
  /** Called when starting a new thread with this chatbot */
  onStartThread?: () => void;
  /** Called when the edit settings action is triggered */
  onEdit?: () => void;
  /** Called when the duplicate action is triggered */
  onDuplicate?: () => void;
  /** Called when the export action is triggered */
  onExport?: () => void;
  /** Called when the delete action is triggered */
  onDelete?: () => void;
  /** Called when the name is updated inline */
  onRename?: (newName: string) => void;
  /** Indentation depth */
  depth?: number;
  /** Whether this item is draggable */
  isDraggable?: boolean;
  /** Additional class names */
  className?: string;
};

export function ChatbotItem({
  chatbot,
  isSelected,
  onClick,
  onStartThread,
  onEdit,
  onDuplicate,
  onExport,
  onDelete,
  onRename,
  depth = 0,
  isDraggable = false,
  className = "",
}: ChatbotItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(chatbot.name);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sortable hook for drag-and-drop
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: chatbot.id,
    data: {
      type: "chatbot",
      chatbot,
    },
    disabled: !isDraggable,
  });

  const style = isDraggable
    ? {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }
    : undefined;

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSaveName = () => {
    const trimmed = editedName.trim();
    if (trimmed && trimmed !== chatbot.name && onRename) {
      onRename(trimmed);
    }
    setIsEditing(false);
    setEditedName(chatbot.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveName();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditedName(chatbot.name);
    }
  };

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedName(chatbot.name);
    setIsEditing(true);
  };

  const handleStartThread = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onStartThread) onStartThread();
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) onEdit();
  };

  const handleDuplicate = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDuplicate) onDuplicate();
  };

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onExport) onExport();
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      `Are you sure you want to delete "${chatbot.name}.chatbot"?\n\nThis will remove the chatbot configuration. Threads using this chatbot will switch to default settings.`
    );
    if (confirmed && onDelete) {
      onDelete();
    }
  };

  // Model provider colors
  const provider = chatbot.config?.model?.provider || "ai";
  const providerColors: Record<string, string> = {
    openai: "bg-green-500",
    claude: "bg-orange-500",
    grok: "bg-blue-500",
    gemini: "bg-purple-500",
  };
  const dotColor = providerColors[provider] || "bg-foreground/50";

  const paddingLeft = depth * 12 + 24; // Extra indent for chatbots within folders

  return (
    <div ref={setNodeRef} style={style} className={className}>
      {isEditing ? (
        <div className="flex items-center gap-1 px-2 py-1.5" style={{ paddingLeft }}>
          <input
            ref={inputRef}
            type="text"
            value={editedName}
            onChange={(e) => setEditedName(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSaveName}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 rounded border border-white/40 bg-white/60 px-2 py-1 text-sm text-foreground focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky"
          />
          <span className="text-xs text-foreground/50">.chatbot</span>
        </div>
      ) : (
        <div
          {...(isDraggable ? { ...attributes, ...listeners } : {})}
          onClick={onClick}
          className={`group relative flex items-center rounded-md px-2 py-1.5 transition-colors ${
            isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
          } ${
            isSelected
              ? "bg-white/60 text-foreground font-medium"
              : "text-foreground hover:bg-white/40"
          }`}
          style={{ paddingLeft }}
        >
          {/* Model provider indicator */}
          <span className={`h-2 w-2 rounded-full flex-shrink-0 mr-2 ${dotColor}`} />

          {/* Name with .chatbot extension */}
          <span className="flex-1 truncate text-sm">
            {chatbot.name}<span className="text-foreground/50">.chatbot</span>
          </span>

          {/* Quick Actions (visible on hover) - horizontal layout like ThreadItem */}
          <div className="absolute right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Start Thread Button */}
            {onStartThread && (
              <button
                type="button"
                onClick={handleStartThread}
                className="rounded p-1 hover:bg-white/40 text-foreground/40 hover:text-sky"
                title="Start new thread with this chatbot"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            )}
            {/* Edit Settings Button */}
            {onEdit && (
              <button
                type="button"
                onClick={handleEdit}
                className="rounded p-1 hover:bg-white/40 text-foreground/40 hover:text-butter"
                title="Edit chatbot settings"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            )}
            {/* Duplicate Button */}
            {onDuplicate && (
              <button
                type="button"
                onClick={handleDuplicate}
                className="rounded p-1 hover:bg-white/40 text-foreground/40 hover:text-lavender"
                title="Duplicate chatbot"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            )}
            {/* Export Button */}
            {onExport && (
              <button
                type="button"
                onClick={handleExport}
                className="rounded p-1 hover:bg-white/40 text-foreground/40 hover:text-mint"
                title="Export chatbot"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
            {/* Rename Button */}
            {onRename && (
              <button
                type="button"
                onClick={handleStartEdit}
                className="rounded p-1 hover:bg-white/40 text-foreground/40 hover:text-sky"
                title="Rename chatbot"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
            )}
            {/* Delete Button */}
            {onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                className="rounded p-1 hover:bg-white/40 text-foreground/40 hover:text-red-400"
                title="Delete chatbot"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
