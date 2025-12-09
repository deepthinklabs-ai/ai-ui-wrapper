"use client";

import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import type { FolderWithChildren } from "@/types/chat";

type NewThreadModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreateThread: (name: string, folderId: string | null) => void;
  folderTree: FolderWithChildren[];
  defaultFolderId?: string | null;
};

type FolderItemProps = {
  folder: FolderWithChildren;
  selectedFolderId: string | null;
  onSelect: (folderId: string) => void;
  depth?: number;
};

function FolderItem({ folder, selectedFolderId, onSelect, depth = 0 }: FolderItemProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = folder.children && folder.children.length > 0;
  const isSelected = selectedFolderId === folder.id;

  return (
    <div>
      <div
        onClick={() => onSelect(folder.id)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-md transition-colors cursor-pointer ${
          isSelected
            ? "bg-blue-600/30 text-blue-200 ring-1 ring-blue-500/50"
            : "hover:bg-slate-700/50 text-slate-300"
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        {/* Expand/collapse button for folders with children */}
        {hasChildren && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="p-0.5 hover:bg-slate-600 rounded"
          >
            <svg
              className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}
        {/* Folder icon */}
        <svg
          className={`w-4 h-4 flex-shrink-0 ${isSelected ? "text-blue-400" : "text-yellow-500"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
        <span className="truncate text-sm">{folder.name}</span>
        {folder.is_default && (
          <span className="text-xs text-slate-500 ml-1">(default)</span>
        )}
      </div>

      {/* Render children */}
      {hasChildren && isExpanded && (
        <div>
          {folder.children.map((child) => (
            <FolderItem
              key={child.id}
              folder={child}
              selectedFolderId={selectedFolderId}
              onSelect={onSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function NewThreadModal({
  isOpen,
  onClose,
  onCreateThread,
  folderTree,
  defaultFolderId,
}: NewThreadModalProps) {
  const [threadName, setThreadName] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(defaultFolderId || null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setThreadName("");
      // Reset to default folder when opening
      setSelectedFolderId(defaultFolderId || null);
    }
  }, [isOpen, defaultFolderId]);

  // Handle escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = threadName.trim();
    if (trimmedName) {
      onCreateThread(trimmedName, selectedFolderId);
      onClose();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Find the default folder if no folder is selected
  const findDefaultFolder = (folders: FolderWithChildren[]): string | null => {
    for (const folder of folders) {
      if (folder.is_default) return folder.id;
      if (folder.children) {
        const found = findDefaultFolder(folder.children);
        if (found) return found;
      }
    }
    return null;
  };

  const effectiveDefaultId = defaultFolderId || findDefaultFolder(folderTree);

  if (!isOpen) return null;

  // Use portal to render at document body level for proper centering
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h2 className="text-lg font-medium text-slate-100">New Thread</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 hover:bg-slate-700 rounded transition-colors"
          >
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Folder browser */}
        <div className="px-4 py-3 border-b border-slate-700">
          <label className="block text-sm font-medium text-slate-400 mb-2">
            Save to Directory
          </label>
          <div className="bg-slate-800 border border-slate-600 rounded-md max-h-48 overflow-y-auto">
            {folderTree.length === 0 ? (
              <div className="px-3 py-4 text-sm text-slate-500 text-center">
                No directories found
              </div>
            ) : (
              <div className="py-1">
                {folderTree.map((folder) => (
                  <FolderItem
                    key={folder.id}
                    folder={folder}
                    selectedFolderId={selectedFolderId}
                    onSelect={setSelectedFolderId}
                  />
                ))}
              </div>
            )}
          </div>
          {selectedFolderId === null && folderTree.length > 0 && (
            <p className="text-xs text-amber-400 mt-1">
              Please select a directory to save the thread
            </p>
          )}
        </div>

        {/* Thread name input */}
        <form onSubmit={handleSubmit} className="px-4 py-4">
          <label className="block text-sm font-medium text-slate-400 mb-2">
            Thread Name
          </label>
          <input
            ref={inputRef}
            type="text"
            value={threadName}
            onChange={(e) => setThreadName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter thread name..."
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />

          {/* Buttons */}
          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-slate-100 hover:bg-slate-700 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!threadName.trim() || (selectedFolderId === null && folderTree.length > 0)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create Thread
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
