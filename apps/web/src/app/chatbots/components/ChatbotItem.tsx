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
  /** Called when the edit action is triggered */
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
  const [showMenu, setShowMenu] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu]);

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

  const handleDelete = () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${chatbot.name}.chatbot"?\n\nThis will remove the chatbot configuration. Threads using this chatbot will switch to default settings.`
    );
    if (confirmed && onDelete) {
      onDelete();
    }
    setShowMenu(false);
  };

  // Model provider colors
  const provider = chatbot.config?.model?.provider || "ai";
  const providerColors: Record<string, string> = {
    openai: "bg-green-500",
    claude: "bg-orange-500",
    grok: "bg-blue-500",
    gemini: "bg-purple-500",
  };
  const dotColor = providerColors[provider] || "bg-slate-500";

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
            className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-100 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
          <span className="text-xs text-slate-500">.chatbot</span>
        </div>
      ) : (
        <div
          {...(isDraggable ? { ...attributes, ...listeners } : {})}
          onClick={onClick}
          className={`group relative flex items-center rounded-md px-2 py-1.5 transition-colors ${
            isDraggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"
          } ${
            isSelected
              ? "bg-slate-800 text-slate-50"
              : "text-slate-200 hover:bg-slate-800/50"
          }`}
          style={{ paddingLeft }}
        >
          {/* Model provider indicator */}
          <span className={`h-2 w-2 rounded-full flex-shrink-0 mr-2 ${dotColor}`} />

          {/* Name with .chatbot extension */}
          <span className="flex-1 truncate text-sm">
            {chatbot.name}<span className="text-slate-500">.chatbot</span>
          </span>

          {/* Action buttons (visible on hover) */}
          <div className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="rounded p-1 hover:bg-slate-700 text-slate-400 hover:text-slate-300"
                title="More actions"
              >
                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>

              {/* Dropdown menu */}
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 w-36 rounded-md border border-slate-700 bg-slate-800 shadow-lg z-20">
                  {onEdit && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onEdit();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                  )}
                  {onRename && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        setIsEditing(true);
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                      </svg>
                      Rename
                    </button>
                  )}
                  {onDuplicate && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onDuplicate();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Duplicate
                    </button>
                  )}
                  {onExport && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowMenu(false);
                        onExport();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      Export
                    </button>
                  )}
                  {onDelete && (
                    <>
                      <div className="my-1 border-t border-slate-700" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
