"use client";

/**
 * useChatbotImport Hook
 *
 * Handles importing chatbot configurations from .chatbot files.
 */

import { useState, useCallback, useRef } from "react";
import type { Chatbot, CreateChatbotInput } from "@/types/chatbot";
import type { ChatbotFile, ChatbotImportResult } from "@/types/chatbotFile";
import {
  parseChatbotFile,
  validateChatbotFile,
  mergeWithDefaults,
  CHATBOT_FILE_EXT,
} from "../lib/chatbotFileUtils";

export type UseChatbotImportResult = {
  /** Whether an import is in progress */
  isImporting: boolean;
  /** Error message if import failed */
  importError: string | null;
  /** The parsed chatbot file (for preview before confirming import) */
  previewFile: ChatbotFile | null;
  /** Import a chatbot from a File object */
  importFromFile: (file: File) => Promise<ChatbotFile | null>;
  /** Import from a JSON string */
  importFromString: (jsonString: string) => Promise<ChatbotFile | null>;
  /** Create a chatbot input from an imported file */
  createChatbotFromImport: (file: ChatbotFile, folderId?: string | null) => CreateChatbotInput;
  /** Clear the preview */
  clearPreview: () => void;
  /** Clear import error */
  clearImportError: () => void;
  /** Trigger file input dialog */
  openFileDialog: () => void;
  /** Check if a file has required OAuth connections */
  checkOAuthRequirements: (file: ChatbotFile) => ChatbotImportResult;
};

type UseChatbotImportOptions = {
  /** Callback when a file is successfully imported */
  onImportSuccess?: (file: ChatbotFile) => void;
  /** Callback when import fails */
  onImportError?: (error: string) => void;
};

export function useChatbotImport(options: UseChatbotImportOptions = {}): UseChatbotImportResult {
  const { onImportSuccess, onImportError } = options;
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<ChatbotFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const importFromString = useCallback(async (jsonString: string): Promise<ChatbotFile | null> => {
    setIsImporting(true);
    setImportError(null);

    try {
      const result = parseChatbotFile(jsonString);

      if (!result.valid || !result.data) {
        const error = result.error ?? "Invalid chatbot file";
        setImportError(error);
        if (onImportError) onImportError(error);
        return null;
      }

      setPreviewFile(result.data);
      if (onImportSuccess) onImportSuccess(result.data);
      return result.data;
    } catch (err: any) {
      const error = err.message ?? "Failed to import chatbot";
      console.error("[useChatbotImport] Error importing:", err);
      setImportError(error);
      if (onImportError) onImportError(error);
      return null;
    } finally {
      setIsImporting(false);
    }
  }, [onImportSuccess, onImportError]);

  const importFromFile = useCallback(async (file: File): Promise<ChatbotFile | null> => {
    // Validate file extension
    if (!file.name.endsWith(CHATBOT_FILE_EXT) && !file.name.endsWith(".json")) {
      const error = `Invalid file type. Expected ${CHATBOT_FILE_EXT} or .json file`;
      setImportError(error);
      if (onImportError) onImportError(error);
      return null;
    }

    setIsImporting(true);
    setImportError(null);

    try {
      const text = await file.text();
      return importFromString(text);
    } catch (err: any) {
      const error = err.message ?? "Failed to read file";
      console.error("[useChatbotImport] Error reading file:", err);
      setImportError(error);
      if (onImportError) onImportError(error);
      return null;
    } finally {
      setIsImporting(false);
    }
  }, [importFromString, onImportError]);

  const createChatbotFromImport = useCallback((
    file: ChatbotFile,
    folderId?: string | null
  ): CreateChatbotInput => {
    // Merge with defaults to ensure all fields are present
    const config = mergeWithDefaults(file.config);

    return {
      name: file.metadata.name,
      description: file.metadata.description,
      folder_id: folderId,
      config,
    };
  }, []);

  const clearPreview = useCallback(() => {
    setPreviewFile(null);
  }, []);

  const clearImportError = useCallback(() => {
    setImportError(null);
  }, []);

  const openFileDialog = useCallback(() => {
    // Create a file input if it doesn't exist
    if (!fileInputRef.current) {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = `${CHATBOT_FILE_EXT},.json`;
      input.style.display = "none";
      input.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files.length > 0) {
          await importFromFile(files[0]);
        }
        // Reset the input so the same file can be selected again
        input.value = "";
      };
      document.body.appendChild(input);
      fileInputRef.current = input;
    }

    fileInputRef.current.click();
  }, [importFromFile]);

  const checkOAuthRequirements = useCallback((file: ChatbotFile): ChatbotImportResult => {
    const oauth = file.config.oauth_requirements;
    if (!oauth) {
      return { success: true, requiresOAuth: false };
    }

    const requiredProviders: string[] = [];
    if (oauth.gmail) requiredProviders.push("gmail");
    if (oauth.calendar) requiredProviders.push("calendar");
    if (oauth.sheets) requiredProviders.push("sheets");
    if (oauth.docs) requiredProviders.push("docs");
    if (oauth.slack) requiredProviders.push("slack");

    if (requiredProviders.length === 0) {
      return { success: true, requiresOAuth: false };
    }

    return {
      success: true,
      requiresOAuth: true,
      requiredOAuthProviders: requiredProviders,
    };
  }, []);

  return {
    isImporting,
    importError,
    previewFile,
    importFromFile,
    importFromString,
    createChatbotFromImport,
    clearPreview,
    clearImportError,
    openFileDialog,
    checkOAuthRequirements,
  };
}
