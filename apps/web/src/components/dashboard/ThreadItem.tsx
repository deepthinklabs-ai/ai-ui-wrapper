"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Thread } from "@/types/chat";

type ThreadItemProps = {
  thread: Thread;
  isSelected: boolean;
  isMultiSelected: boolean;
  isInContext?: boolean;
  onSelect: () => void;
  onMultiSelect: (e: React.MouseEvent) => void;
  onDelete: () => Promise<void>;
  onUpdateTitle: (newTitle: string) => Promise<void>;
  onAddToContext?: () => void;
  onExport?: () => void;
  onShowInfo?: () => void;
  depth: number;
};

export function ThreadItem({
  thread,
  isSelected,
  isMultiSelected,
  isInContext = false,
  onSelect,
  onMultiSelect,
  onDelete,
  onUpdateTitle,
  onAddToContext,
  onExport,
  onShowInfo,
  depth,
}: ThreadItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(thread.title || "New thread");
  const editInputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: thread.id,
    data: {
      type: "thread",
      thread,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [isEditing]);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedTitle(thread.title || "New thread");
    setIsEditing(true);
  };

  const handleSaveEdit = async () => {
    const trimmedTitle = editedTitle.trim();
    if (trimmedTitle && trimmedTitle !== thread.title) {
      await onUpdateTitle(trimmedTitle);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveEdit();
    } else if (e.key === "Escape") {
      setIsEditing(false);
      setEditedTitle(thread.title || "New thread");
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      `Are you sure you want to delete "${thread.title || 'Untitled'}.thread"?\n\nThis will permanently delete the .thread file and all its messages.`
    );
    if (confirmed) {
      await onDelete();
    }
  };

  const paddingLeft = depth * 12 + 24; // Extra indent for threads within folders

  // Handle click with modifier key detection
  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      // Multi-select mode
      onMultiSelect(e);
    } else {
      // Normal select (also clears multi-selection)
      onSelect();
    }
  };

  const handleAddToContext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onAddToContext) {
      onAddToContext();
    }
  };

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onExport) {
      onExport();
    }
  };

  const handleShowInfo = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onShowInfo) {
      onShowInfo();
    }
  };

  // Determine styling based on selection state
  const getSelectionClasses = () => {
    if (isInContext) {
      // Thread is added to context panel
      return "bg-lavender/30 text-foreground ring-1 ring-lavender/50";
    }
    if (isMultiSelected) {
      // Multi-selected threads get a distinct highlight
      return "bg-sky/30 text-foreground ring-1 ring-sky/50";
    }
    if (isSelected) {
      // Currently active thread (for viewing)
      return "bg-white/60 text-foreground font-medium";
    }
    return "text-foreground hover:bg-white/40";
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        {...attributes}
        {...listeners}
        onClick={handleClick}
        className={`group relative flex items-center rounded-md px-2 py-1.5 cursor-grab active:cursor-grabbing transition-colors ${getSelectionClasses()}`}
        style={{ paddingLeft }}
      >
        {/* Checkbox for multi-select or Thread Icon */}
        {isMultiSelected ? (
          <svg
            className="h-4 w-4 flex-shrink-0 mr-2 text-blue-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        ) : (
          <svg
            className="h-4 w-4 flex-shrink-0 mr-2 text-foreground/50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        )}

        {/* Thread Title */}
        {isEditing ? (
          <div className="flex-1 flex items-center gap-1">
            <input
              ref={editInputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={handleSaveEdit}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 rounded border border-white/40 bg-white/60 px-1.5 py-0.5 text-sm text-foreground focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky"
            />
            <span className="text-xs text-foreground/50">.thread</span>
          </div>
        ) : (
          <span className="flex-1 truncate text-sm">
            {thread.title || "Untitled"}<span className="text-foreground/50">.thread</span>
          </span>
        )}

        {/* Quick Actions (visible on hover) */}
        {!isEditing && (
          <div className="absolute right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Add to Context Button */}
            {onAddToContext && (
              <button
                type="button"
                onClick={handleAddToContext}
                className={`rounded p-1 hover:bg-white/40 ${
                  isInContext
                    ? "text-lavender hover:text-lavender"
                    : "text-foreground/40 hover:text-lavender"
                }`}
                title={isInContext ? "Already in context" : "Add to context"}
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
            {/* Export Button */}
            {onExport && (
              <button
                type="button"
                onClick={handleExport}
                className="rounded p-1 hover:bg-white/40 text-foreground/40 hover:text-mint"
                title="Export thread"
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
            {/* Info Button */}
            {onShowInfo && (
              <button
                type="button"
                onClick={handleShowInfo}
                className="rounded p-1 hover:bg-white/40 text-foreground/40 hover:text-sky"
                title="Thread properties"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            )}
            <button
              type="button"
              onClick={handleStartEdit}
              className="rounded p-1 hover:bg-white/40 text-foreground/40 hover:text-sky"
              title="Rename thread"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded p-1 hover:bg-white/40 text-foreground/40 hover:text-red-400"
              title="Delete thread"
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
      </div>
    </div>
  );
}
