"use client";

import React, { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Thread } from "@/types/chat";

type ThreadItemProps = {
  thread: Thread;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => Promise<void>;
  onUpdateTitle: (newTitle: string) => Promise<void>;
  depth: number;
};

export function ThreadItem({
  thread,
  isSelected,
  onSelect,
  onDelete,
  onUpdateTitle,
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
      `Are you sure you want to delete "${thread.title || 'New thread'}"?\n\nThis will permanently delete the thread and all its messages.`
    );
    if (confirmed) {
      await onDelete();
    }
  };

  const paddingLeft = depth * 12 + 24; // Extra indent for threads within folders

  return (
    <div ref={setNodeRef} style={style}>
      <div
        {...attributes}
        {...listeners}
        onClick={onSelect}
        className={`group relative flex items-center rounded-md px-2 py-1.5 cursor-grab active:cursor-grabbing transition-colors ${
          isSelected
            ? "bg-slate-800 text-slate-50"
            : "text-slate-200 hover:bg-slate-800/50"
        }`}
        style={{ paddingLeft }}
      >
        {/* Thread Icon */}
        <svg
          className="h-4 w-4 flex-shrink-0 mr-2 text-slate-500"
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

        {/* Thread Title */}
        {isEditing ? (
          <input
            ref={editInputRef}
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSaveEdit}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-sm text-slate-100 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
        ) : (
          <span className="flex-1 truncate text-sm">
            {thread.title || "New thread"}
          </span>
        )}

        {/* Quick Actions (visible on hover) */}
        {!isEditing && (
          <div className="absolute right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={handleStartEdit}
              className="rounded p-1 hover:bg-slate-700 text-slate-400 hover:text-blue-400"
              title="Rename thread"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="rounded p-1 hover:bg-slate-700 text-slate-400 hover:text-red-400"
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
