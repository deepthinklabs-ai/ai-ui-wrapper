"use client";

/**
 * ChatbotImportButton Component
 *
 * Button for importing chatbot configurations from .chatbot files.
 */

import React from "react";
import { useChatbotImport } from "../hooks/useChatbotImport";
import type { CreateChatbotInput } from "@/types/chatbot";

type ChatbotImportButtonProps = {
  /** Called when a chatbot file is successfully imported */
  onImport: (input: CreateChatbotInput) => Promise<void>;
  /** Default folder ID for imported chatbot */
  folderId?: string | null;
  /** Compact mode (icon only) */
  compact?: boolean;
  /** Additional class names */
  className?: string;
};

export function ChatbotImportButton({
  onImport,
  folderId,
  compact = false,
  className = "",
}: ChatbotImportButtonProps) {
  const {
    isImporting,
    importError,
    previewFile,
    openFileDialog,
    createChatbotFromImport,
    clearPreview,
    clearImportError,
  } = useChatbotImport({
    onImportSuccess: async (file) => {
      // Automatically create the chatbot from the imported file
      const input = createChatbotFromImport(file, folderId);
      await onImport(input);
      clearPreview();
    },
  });

  return (
    <>
      <button
        type="button"
        onClick={openFileDialog}
        disabled={isImporting}
        className={`flex items-center justify-center rounded-md text-slate-200 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
          compact ? "h-8 w-8" : "px-3 py-1.5 gap-2"
        } ${className}`}
        title={compact ? "Import .chatbot file" : undefined}
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        {!compact && <span className="text-sm">Import</span>}
      </button>

      {/* Error toast (simplified) */}
      {importError && (
        <div className="fixed bottom-4 right-4 z-50 max-w-sm rounded-md border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 shadow-lg">
          <div className="flex items-start justify-between gap-2">
            <span>{importError}</span>
            <button
              type="button"
              onClick={clearImportError}
              className="flex-shrink-0 rounded p-1 hover:bg-red-500/20"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
