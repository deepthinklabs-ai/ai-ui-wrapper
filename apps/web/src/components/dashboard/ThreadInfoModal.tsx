"use client";

/**
 * ThreadInfoModal Component
 *
 * Displays thread properties/metadata in a modal, similar to
 * file properties on a local computer (created date, modified date, owner, etc.)
 */

import React, { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import type { Thread, Message } from "@/types/chat";

type ThreadInfoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  thread: Thread | null;
  messages: Message[];
  userEmail?: string;
};

/**
 * Format a date string for display
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Format file size (approximate based on message content)
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Calculate total tokens from messages
 */
function calculateTotalTokens(messages: Message[]): { input: number; output: number; total: number } {
  let input = 0;
  let output = 0;
  let total = 0;

  // Debug: log token fields for each message
  console.log('[ThreadInfoModal] Calculating tokens from', messages.length, 'messages');
  for (const msg of messages) {
    console.log('[ThreadInfoModal] Message', msg.id, 'tokens:', {
      role: msg.role,
      input_tokens: msg.input_tokens,
      output_tokens: msg.output_tokens,
      total_tokens: msg.total_tokens,
    });
    if (msg.input_tokens) input += msg.input_tokens;
    if (msg.output_tokens) output += msg.output_tokens;
    if (msg.total_tokens) total += msg.total_tokens;
  }

  // If total wasn't tracked, calculate from input + output
  if (total === 0 && (input > 0 || output > 0)) {
    total = input + output;
  }

  console.log('[ThreadInfoModal] Final token totals:', { input, output, total });
  return { input, output, total };
}

/**
 * Get the models used in the thread
 */
function getModelsUsed(messages: Message[]): string[] {
  const models = new Set<string>();
  for (const msg of messages) {
    if (msg.model) {
      models.add(msg.model);
    }
  }
  return Array.from(models);
}

/**
 * Estimate the file size based on content
 */
function estimateSize(thread: Thread | null, messages: Message[]): number {
  if (!thread) return 0;

  let size = JSON.stringify(thread).length;
  for (const msg of messages) {
    size += JSON.stringify(msg).length;
  }
  return size;
}

const ThreadInfoModal: React.FC<ThreadInfoModalProps> = ({
  isOpen,
  onClose,
  thread,
  messages: passedMessages,
  userEmail,
}) => {
  const [loadedMessages, setLoadedMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // If messages are passed, use them; otherwise load from DB
  const messages = passedMessages.length > 0 ? passedMessages : loadedMessages;

  // Load messages if not provided and modal is open
  useEffect(() => {
    if (!isOpen || !thread || passedMessages.length > 0) return;

    const loadMessages = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .eq("thread_id", thread.id)
          .order("created_at", { ascending: true });

        if (!error && data) {
          setLoadedMessages(data as Message[]);
        }
      } catch (err) {
        console.error("[ThreadInfoModal] Failed to load messages:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [isOpen, thread, passedMessages.length]);

  // Clear loaded messages when modal closes
  useEffect(() => {
    if (!isOpen) {
      setLoadedMessages([]);
    }
  }, [isOpen]);

  if (!isOpen || !thread) return null;

  const tokens = calculateTotalTokens(messages);
  const modelsUsed = getModelsUsed(messages);
  const estimatedSize = estimateSize(thread, messages);
  const userCount = messages.filter(m => m.role === "user").length;
  const assistantCount = messages.filter(m => m.role === "assistant").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-slate-900 border border-slate-700 rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <h2 className="text-sm font-medium text-slate-100">Thread Properties</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* File name section */}
          <div className="pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-800 rounded-lg">
                <svg
                  className="w-8 h-8 text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-100 truncate">
                  {thread.title || "Untitled"}.thread
                </p>
                <p className="text-xs text-slate-500">Thread File</p>
              </div>
            </div>
          </div>

          {/* Properties grid */}
          <div className="space-y-3 text-sm">
            {/* General section */}
            <div className="space-y-2">
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide">General</h3>

              <div className="grid grid-cols-[120px_1fr] gap-y-1.5">
                <span className="text-slate-500">Type:</span>
                <span className="text-slate-300">.thread file</span>

                <span className="text-slate-500">Size:</span>
                <span className="text-slate-300">{formatSize(estimatedSize)}</span>

                <span className="text-slate-500">Messages:</span>
                <span className="text-slate-300">
                  {isLoading ? (
                    <span className="text-slate-500 animate-pulse">Loading...</span>
                  ) : (
                    `${messages.length} total (${userCount} user, ${assistantCount} assistant)`
                  )}
                </span>
              </div>
            </div>

            {/* Dates section */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Dates</h3>

              <div className="grid grid-cols-[120px_1fr] gap-y-1.5">
                <span className="text-slate-500">Created:</span>
                <span className="text-slate-300">{formatDate(thread.created_at)}</span>

                <span className="text-slate-500">Modified:</span>
                <span className="text-slate-300">{formatDate(thread.updated_at)}</span>
              </div>
            </div>

            {/* Owner section */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Owner</h3>

              <div className="grid grid-cols-[120px_1fr] gap-y-1.5">
                <span className="text-slate-500">Created by:</span>
                <span className="text-slate-300">{userEmail || "—"}</span>
              </div>
            </div>

            {/* Usage section */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Usage</h3>

              <div className="grid grid-cols-[120px_1fr] gap-y-1.5">
                <span className="text-slate-500">Total tokens:</span>
                <span className="text-slate-300">
                  {tokens.total > 0 ? tokens.total.toLocaleString() : "—"}
                </span>

                <span className="text-slate-500">Input tokens:</span>
                <span className="text-slate-300">
                  {tokens.input > 0 ? tokens.input.toLocaleString() : "—"}
                </span>

                <span className="text-slate-500">Output tokens:</span>
                <span className="text-slate-300">
                  {tokens.output > 0 ? tokens.output.toLocaleString() : "—"}
                </span>

                <span className="text-slate-500">Models used:</span>
                <span className="text-slate-300">
                  {modelsUsed.length > 0 ? modelsUsed.join(", ") : "—"}
                </span>
              </div>
            </div>

            {/* ID section */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wide">Identifiers</h3>

              <div className="grid grid-cols-[120px_1fr] gap-y-1.5">
                <span className="text-slate-500">Thread ID:</span>
                <span className="text-slate-300 font-mono text-xs break-all">{thread.id}</span>

                {thread.folder_id && (
                  <>
                    <span className="text-slate-500">Folder ID:</span>
                    <span className="text-slate-300 font-mono text-xs break-all">{thread.folder_id}</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end px-4 py-3 border-t border-slate-700 bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThreadInfoModal;
