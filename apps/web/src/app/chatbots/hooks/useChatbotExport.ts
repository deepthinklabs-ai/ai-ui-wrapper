"use client";

/**
 * useChatbotExport Hook
 *
 * Handles exporting chatbot configurations to .chatbot files.
 */

import { useState, useCallback } from "react";
import type { Chatbot } from "@/types/chatbot";
import type { ChatbotExportOptions, ChatbotFile } from "@/types/chatbotFile";
import {
  serializeChatbot,
  downloadChatbotFile,
  generateChatbotFilename,
  createChatbotFileBlob,
} from "../lib/chatbotFileUtils";

export type UseChatbotExportResult = {
  /** Whether an export is in progress */
  isExporting: boolean;
  /** Error message if export failed */
  exportError: string | null;
  /** Export a chatbot to a file download */
  exportChatbot: (chatbot: Chatbot, options?: ChatbotExportOptions) => Promise<boolean>;
  /** Export a chatbot and return the file object (for preview/custom handling) */
  prepareChatbotFile: (chatbot: Chatbot, options?: ChatbotExportOptions) => ChatbotFile;
  /** Export a chatbot and return a blob (for programmatic use) */
  exportChatbotAsBlob: (chatbot: Chatbot, options?: ChatbotExportOptions) => Blob;
  /** Clear export error */
  clearExportError: () => void;
};

export function useChatbotExport(): UseChatbotExportResult {
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const prepareChatbotFile = useCallback((
    chatbot: Chatbot,
    options: ChatbotExportOptions = {}
  ): ChatbotFile => {
    return serializeChatbot(chatbot, options);
  }, []);

  const exportChatbotAsBlob = useCallback((
    chatbot: Chatbot,
    options: ChatbotExportOptions = {}
  ): Blob => {
    const file = serializeChatbot(chatbot, options);
    return createChatbotFileBlob(file);
  }, []);

  const exportChatbot = useCallback(async (
    chatbot: Chatbot,
    options: ChatbotExportOptions = {}
  ): Promise<boolean> => {
    setIsExporting(true);
    setExportError(null);

    try {
      const file = serializeChatbot(chatbot, options);
      const filename = generateChatbotFilename(chatbot.name);
      downloadChatbotFile(file, filename);
      return true;
    } catch (err: any) {
      console.error("[useChatbotExport] Error exporting chatbot:", err);
      setExportError(err.message ?? "Failed to export chatbot");
      return false;
    } finally {
      setIsExporting(false);
    }
  }, []);

  const clearExportError = useCallback(() => {
    setExportError(null);
  }, []);

  return {
    isExporting,
    exportError,
    exportChatbot,
    prepareChatbotFile,
    exportChatbotAsBlob,
    clearExportError,
  };
}
