"use client";

/**
 * NewChatbotModal Component
 *
 * Modal for creating new chatbot configurations.
 * Allows setting name, description, and optionally importing from file.
 */

import React, { useState, useEffect, useRef } from "react";
import type { ChatbotFolderWithChildren, CreateChatbotInput } from "@/types/chatbot";
import type { ChatbotFileConfig } from "@/types/chatbotFile";
import { createDefaultChatbotConfig } from "../lib/chatbotFileUtils";

type NewChatbotModalProps = {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Called when the modal should close */
  onClose: () => void;
  /** Called when a new chatbot should be created */
  onCreate: (input: CreateChatbotInput) => Promise<void>;
  /** Folder tree for selecting where to save */
  folderTree?: ChatbotFolderWithChildren[];
  /** Default folder ID */
  defaultFolderId?: string | null;
  /** Current UI config to use as initial values */
  currentConfig?: ChatbotFileConfig | null;
  /** Loading state */
  loading?: boolean;
};

export function NewChatbotModal({
  isOpen,
  onClose,
  onCreate,
  folderTree = [],
  defaultFolderId = null,
  currentConfig,
  loading = false,
}: NewChatbotModalProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState<string | null>(defaultFolderId);
  const [useCurrentSettings, setUseCurrentSettings] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName("");
      setDescription("");
      setFolderId(defaultFolderId);
      setUseCurrentSettings(true);
      setError(null);
      // Focus name input after a short delay
      setTimeout(() => {
        nameInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, defaultFolderId]);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Please enter a name for the chatbot");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      // Use current settings or create default config
      const config = useCurrentSettings && currentConfig
        ? { ...currentConfig }
        : createDefaultChatbotConfig();

      await onCreate({
        name: trimmedName,
        description: description.trim() || undefined,
        folder_id: folderId,
        config,
      });

      onClose();
    } catch (err: any) {
      console.error("[NewChatbotModal] Error creating chatbot:", err);
      setError(err.message || "Failed to create chatbot");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Flatten folder tree for select dropdown
  const flattenFolders = (
    folders: ChatbotFolderWithChildren[],
    depth = 0
  ): Array<{ id: string; name: string; depth: number }> => {
    const result: Array<{ id: string; name: string; depth: number }> = [];
    for (const folder of folders) {
      result.push({ id: folder.id, name: folder.name, depth });
      if (folder.children.length > 0) {
        result.push(...flattenFolders(folder.children, depth + 1));
      }
    }
    return result;
  };

  const flatFolders = flattenFolders(folderTree);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md rounded-lg border border-slate-700 bg-slate-800 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-100">New Chatbot</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4">
          {/* Error message */}
          {error && (
            <div className="mb-4 rounded-md bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Name input */}
          <div className="mb-4">
            <label htmlFor="chatbot-name" className="block text-sm font-medium text-slate-300 mb-1">
              Name <span className="text-red-400">*</span>
            </label>
            <input
              ref={nameInputRef}
              id="chatbot-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Chatbot"
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              disabled={isSubmitting}
            />
          </div>

          {/* Description input */}
          <div className="mb-4">
            <label htmlFor="chatbot-description" className="block text-sm font-medium text-slate-300 mb-1">
              Description <span className="text-slate-500">(optional)</span>
            </label>
            <textarea
              id="chatbot-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A helpful assistant for..."
              rows={2}
              className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 resize-none"
              disabled={isSubmitting}
            />
          </div>

          {/* Folder select */}
          {flatFolders.length > 0 && (
            <div className="mb-4">
              <label htmlFor="chatbot-folder" className="block text-sm font-medium text-slate-300 mb-1">
                Save in folder
              </label>
              <select
                id="chatbot-folder"
                value={folderId || ""}
                onChange={(e) => setFolderId(e.target.value || null)}
                className="w-full rounded-md border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-100 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                disabled={isSubmitting}
              >
                <option value="">No folder</option>
                {flatFolders.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {"  ".repeat(folder.depth)}{folder.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Use current settings toggle */}
          {currentConfig && (
            <div className="mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useCurrentSettings}
                  onChange={(e) => setUseCurrentSettings(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-slate-800"
                  disabled={isSubmitting}
                />
                <span className="text-sm text-slate-300">
                  Use current settings (model, system prompt, features)
                </span>
              </label>
              <p className="ml-6 mt-1 text-xs text-slate-500">
                {useCurrentSettings
                  ? "The chatbot will be created with your current configuration."
                  : "The chatbot will be created with default settings."}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-600 bg-transparent px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSubmitting || !name.trim()}
            >
              {isSubmitting ? "Creating..." : "Create Chatbot"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
