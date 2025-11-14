/**
 * Split Chat View Component
 *
 * Displays two chat panels side by side with a draggable divider.
 * Allows users to view and interact with two threads simultaneously.
 */

"use client";

import React, { useState, useRef, useCallback } from "react";
import type { AIModel } from "@/lib/apiKeyStorage";
import type { UserTier } from "@/hooks/useUserTier";
import type { Thread } from "@/types/chat";
import ChatPanel from "./ChatPanel";

interface SplitChatViewProps {
  leftThreadId: string | null;
  rightThreadId: string | null;
  threads: Thread[];
  userId: string | undefined;
  userTier: UserTier;
  selectedModel: AIModel;
  onModelChange: (model: AIModel) => void;
  onThreadTitleUpdated?: () => void;
  onCreateThread: () => Promise<string | null>;
  onForkThread?: (fromThreadId: string, fromMessageId: string, newTitle?: string) => Promise<string | null>;
  onClose: () => void;
  onSwapPanels: () => void;
  onSelectLeftThread: (threadId: string) => void;
  onSelectRightThread: (threadId: string) => void;
  isFeatureEnabled?: (feature: string) => boolean;
  initialSplitRatio?: number;
  crossChatEnabled?: boolean;
  onToggleCrossChat?: () => void;
}

export default function SplitChatView({
  leftThreadId,
  rightThreadId,
  threads,
  userId,
  userTier,
  selectedModel,
  onModelChange,
  onThreadTitleUpdated,
  onCreateThread,
  onForkThread,
  onClose,
  onSwapPanels,
  onSelectLeftThread,
  onSelectRightThread,
  isFeatureEnabled,
  initialSplitRatio = 50,
  crossChatEnabled = false,
  onToggleCrossChat,
}: SplitChatViewProps) {
  const [splitRatio, setSplitRatio] = useState(initialSplitRatio);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const leftThread = threads.find((t) => t.id === leftThreadId) || null;
  const rightThread = threads.find((t) => t.id === rightThreadId) || null;

  // Store sendMessage refs for cross-chat
  const leftSendMessageRef = useRef<((message: string, files: File[]) => Promise<void>) | null>(null);
  const rightSendMessageRef = useRef<((message: string, files: File[]) => Promise<void>) | null>(null);

  // Cross-chat: Handle AI responses from each panel
  const handleLeftAIResponse = useCallback(async (content: string) => {
    if (!crossChatEnabled || !rightThreadId || !rightSendMessageRef.current) return;

    console.log('[Cross-Chat] Left AI responded, relaying to right panel');
    const relayMessage = `**[Message from Left Panel AI]**\n\n${content}`;

    // Send to right panel
    try {
      await rightSendMessageRef.current(relayMessage, []);
    } catch (error) {
      console.error('[Cross-Chat] Failed to relay message to right panel:', error);
    }
  }, [crossChatEnabled, rightThreadId]);

  const handleRightAIResponse = useCallback(async (content: string) => {
    if (!crossChatEnabled || !leftThreadId || !leftSendMessageRef.current) return;

    console.log('[Cross-Chat] Right AI responded, relaying to left panel');
    const relayMessage = `**[Message from Right Panel AI]**\n\n${content}`;

    // Send to left panel
    try {
      await leftSendMessageRef.current(relayMessage, []);
    } catch (error) {
      console.error('[Cross-Chat] Failed to relay message to left panel:', error);
    }
  }, [crossChatEnabled, leftThreadId]);

  // Create new thread handlers
  const handleCreateLeftThread = useCallback(async () => {
    const newThreadId = await onCreateThread();
    if (newThreadId) {
      onSelectLeftThread(newThreadId);
    }
    return newThreadId;
  }, [onCreateThread, onSelectLeftThread]);

  const handleCreateRightThread = useCallback(async () => {
    const newThreadId = await onCreateThread();
    if (newThreadId) {
      onSelectRightThread(newThreadId);
    }
    return newThreadId;
  }, [onCreateThread, onSelectRightThread]);

  // Handle divider drag
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const newRatio = ((e.clientX - containerRect.left) / containerRect.width) * 100;

    // Clamp between 20% and 80%
    setSplitRatio(Math.max(20, Math.min(80, newRatio)));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Set up mouse event listeners
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);

      // Prevent text selection during drag
      document.body.style.userSelect = "none";
      document.body.style.cursor = "ew-resize";

      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
      };
    }
  }, [isDragging]);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-950">
      {/* Header with controls */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-slate-100">Split View</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={onSwapPanels}
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
              title="Swap panels"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            </button>
            <button
              onClick={() => setSplitRatio(50)}
              className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
              title="Reset to 50/50 split"
            >
              Reset Split
            </button>
            {onToggleCrossChat && (
              <button
                onClick={onToggleCrossChat}
                className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-2 ${
                  crossChatEnabled
                    ? 'border-green-600 bg-green-600 text-white hover:bg-green-500'
                    : 'border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700'
                }`}
                title="Toggle AI cross-chat (AIs talk to each other)"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                {crossChatEnabled ? 'Cross-Chat ON' : 'Cross-Chat OFF'}
              </button>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
        >
          Exit Split View
        </button>
      </div>

      {/* Split view container */}
      <div ref={containerRef} className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div
          className="overflow-hidden"
          style={{ width: `${splitRatio}%` }}
        >
          {/* Thread selector for left */}
          <div className="border-b border-slate-800 bg-slate-900/50 px-4 py-2">
            <select
              value={leftThreadId || ""}
              onChange={(e) => onSelectLeftThread(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select a thread...</option>
              {threads.map((thread) => (
                <option key={thread.id} value={thread.id}>
                  {thread.title}
                </option>
              ))}
            </select>
          </div>

          {leftThreadId ? (
            <ChatPanel
              threadId={leftThreadId}
              thread={leftThread}
              userId={userId}
              userTier={userTier}
              selectedModel={selectedModel}
              onModelChange={onModelChange}
              onThreadTitleUpdated={onThreadTitleUpdated}
              onCreateThread={handleCreateLeftThread}
              onForkThread={onForkThread}
              isFeatureEnabled={isFeatureEnabled}
              showHeader={false}
              crossChatEnabled={crossChatEnabled}
              onAIResponse={handleLeftAIResponse}
              exposeSendMessage={(sendFn) => {
                leftSendMessageRef.current = sendFn;
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500">
              <div className="text-center">
                <p className="text-lg font-medium">No thread selected</p>
                <p className="mt-2 text-sm">Select a thread from the dropdown above</p>
              </div>
            </div>
          )}
        </div>

        {/* Draggable Divider */}
        <div
          className={`relative w-1 cursor-ew-resize bg-slate-800 hover:bg-blue-500 transition-colors ${
            isDragging ? "bg-blue-500" : ""
          }`}
          onMouseDown={handleMouseDown}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
          {/* Drag handle indicator */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1">
            <div className="h-1 w-1 rounded-full bg-slate-600" />
            <div className="h-1 w-1 rounded-full bg-slate-600" />
            <div className="h-1 w-1 rounded-full bg-slate-600" />
          </div>
        </div>

        {/* Right Panel */}
        <div
          className="overflow-hidden"
          style={{ width: `${100 - splitRatio}%` }}
        >
          {/* Thread selector for right */}
          <div className="border-b border-slate-800 bg-slate-900/50 px-4 py-2">
            <select
              value={rightThreadId || ""}
              onChange={(e) => onSelectRightThread(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select a thread...</option>
              {threads.map((thread) => (
                <option key={thread.id} value={thread.id}>
                  {thread.title}
                </option>
              ))}
            </select>
          </div>

          {rightThreadId ? (
            <ChatPanel
              threadId={rightThreadId}
              thread={rightThread}
              userId={userId}
              userTier={userTier}
              selectedModel={selectedModel}
              onModelChange={onModelChange}
              onThreadTitleUpdated={onThreadTitleUpdated}
              onCreateThread={handleCreateRightThread}
              onForkThread={onForkThread}
              isFeatureEnabled={isFeatureEnabled}
              showHeader={false}
              crossChatEnabled={crossChatEnabled}
              onAIResponse={handleRightAIResponse}
              exposeSendMessage={(sendFn) => {
                rightSendMessageRef.current = sendFn;
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500">
              <div className="text-center">
                <p className="text-lg font-medium">No thread selected</p>
                <p className="mt-2 text-sm">Select a thread from the dropdown above</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
