/**
 * ThreadImportButton Component
 *
 * A button component for importing .thread files.
 * Handles file selection and triggers the import process.
 */

"use client";

import React from "react";
import { useThreadImport } from "@/hooks/useThreadImport";
import { THREAD_FILE_EXTENSION } from "@/types/threadFile";

type ThreadImportButtonProps = {
  /** User ID for creating the imported thread */
  userId: string;
  /** Optional folder ID to place the imported thread */
  folderId?: string | null;
  /** Callback when import completes successfully */
  onImportComplete?: () => void;
  /** Callback to refresh the threads list */
  refreshThreads?: () => Promise<void>;
  /** Callback to select the newly imported thread */
  selectThread?: (threadId: string) => void;
  /** Optional className for styling */
  className?: string;
  /** Whether to show as a compact button (icon only) */
  compact?: boolean;
  /** Optional encryption function for encrypting imported messages */
  encryptForStorage?: (plaintext: string) => Promise<string>;
};

export function ThreadImportButton({
  userId,
  folderId,
  onImportComplete,
  refreshThreads,
  selectThread,
  className = "",
  compact = false,
  encryptForStorage,
}: ThreadImportButtonProps) {
  const {
    importThread,
    openFilePicker,
    isImporting,
    error,
    clearError,
    fileInputRef,
  } = useThreadImport({
    userId,
    folderId,
    onImportComplete: (result) => {
      console.log(`[ThreadImportButton] Import successful: ${result.messageCount} messages`);
      onImportComplete?.();
    },
    onImportError: (errorMsg) => {
      console.error(`[ThreadImportButton] Import failed: ${errorMsg}`);
    },
    refreshThreads,
    selectThread,
    encryptForStorage,
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await importThread(file);
      // Reset the input so the same file can be imported again if needed
      e.target.value = "";
    }
  };

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={THREAD_FILE_EXTENSION}
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Import button */}
      <button
        type="button"
        onClick={openFilePicker}
        disabled={isImporting}
        className={`flex items-center gap-1.5 rounded-md text-slate-300 hover:bg-slate-700 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
          compact ? "p-1.5" : "px-2 py-1.5"
        } ${className}`}
        title={isImporting ? "Importing..." : "Import .thread file"}
      >
        {isImporting ? (
          <svg
            className="h-4 w-4 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
        )}
        {!compact && (
          <span className="text-sm">
            {isImporting ? "Importing..." : "Import"}
          </span>
        )}
      </button>

      {/* Error toast */}
      {error && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-md bg-red-900/90 px-4 py-2 text-sm text-red-100 shadow-lg">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>{error}</span>
          <button
            type="button"
            onClick={clearError}
            className="ml-2 rounded p-0.5 hover:bg-red-800"
          >
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
