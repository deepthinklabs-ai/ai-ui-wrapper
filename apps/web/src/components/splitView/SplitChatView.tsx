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
import type { MessageType, QuickSendTarget } from "@/types/splitView";
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
  leftPanelName: string;
  rightPanelName: string;
  onLeftPanelNameChange: (name: string) => void;
  onRightPanelNameChange: (name: string) => void;
  messageType: MessageType;
  onMessageTypeChange: (type: MessageType) => void;
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
  leftPanelName,
  rightPanelName,
  onLeftPanelNameChange,
  onRightPanelNameChange,
  messageType,
  onMessageTypeChange,
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
  // LEFT → RIGHT: Always relay (instruction or chat)
  const handleLeftAIResponse = useCallback(async (content: string) => {
    if (!crossChatEnabled || !rightThreadId || !rightSendMessageRef.current) return;

    // Clear the "responded" flag when sending a new message (allows right to respond to new message)
    if (messageType === 'chat') {
      sessionStorage.removeItem(`chatMode_${rightThreadId}_responded`);
    }

    const messageTypeLabel = messageType === 'instruction' ? 'Instruction' : 'Chat';
    console.log(`[Cross-Chat] ${leftPanelName} sending ${messageTypeLabel.toLowerCase()} to ${rightPanelName}`);
    const relayMessage = `**[${messageTypeLabel} from ${leftPanelName}]**\n\n${content}`;

    // Send to right panel
    try {
      await rightSendMessageRef.current(relayMessage, []);
    } catch (error) {
      console.error(`[Cross-Chat] Failed to send to ${rightPanelName}:`, error);
    }
  }, [crossChatEnabled, rightThreadId, leftPanelName, rightPanelName, messageType]);

  // RIGHT → LEFT: Hard-coded rules based on message type
  const handleRightAIResponse = useCallback(async (content: string) => {
    if (!crossChatEnabled || !leftThreadId || !leftSendMessageRef.current) return;

    // INSTRUCTION MODE: Only relay if it's a genuine clarifying question
    if (messageType === 'instruction') {
      // Check if the response contains question indicators
      const isQuestion = content.includes('?') ||
                        content.toLowerCase().includes('clarif') ||
                        content.toLowerCase().includes('could you') ||
                        content.toLowerCase().includes('can you') ||
                        content.toLowerCase().includes('please confirm') ||
                        content.toLowerCase().includes('not sure') ||
                        content.toLowerCase().includes('unclear');

      if (!isQuestion) {
        console.log(`[Cross-Chat] INSTRUCTION MODE: ${rightPanelName} response blocked (not a question)`);
        return; // HARD BLOCK - do not relay
      }

      console.log(`[Cross-Chat] INSTRUCTION MODE: ${rightPanelName} asking clarifying question to ${leftPanelName}`);
      const relayMessage = `**[Question from ${rightPanelName}]**\n\n${content}`;

      try {
        await leftSendMessageRef.current(relayMessage, []);
      } catch (error) {
        console.error(`[Cross-Chat] Failed to send question to ${leftPanelName}:`, error);
      }
    }
    // CHAT MODE: Only relay the FIRST response, then block all subsequent ones
    else if (messageType === 'chat') {
      // Track if we've already sent one response
      const hasResponded = sessionStorage.getItem(`chatMode_${rightThreadId}_responded`);

      if (hasResponded) {
        console.log(`[Cross-Chat] CHAT MODE: ${rightPanelName} already responded once, blocking subsequent response`);
        return; // HARD BLOCK - already sent first response
      }

      console.log(`[Cross-Chat] CHAT MODE: ${rightPanelName} sending first response to ${leftPanelName}`);
      const relayMessage = `**[Response from ${rightPanelName}]**\n\n${content}`;

      try {
        await leftSendMessageRef.current(relayMessage, []);
        // Mark that we've sent one response
        sessionStorage.setItem(`chatMode_${rightThreadId}_responded`, 'true');
      } catch (error) {
        console.error(`[Cross-Chat] Failed to send response to ${leftPanelName}:`, error);
      }
    }
  }, [crossChatEnabled, leftThreadId, leftPanelName, rightPanelName, messageType, rightThreadId]);

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

  // Quick-send: Build target lists for each panel
  const leftQuickSendTargets: QuickSendTarget[] = rightThreadId
    ? [{ panelId: 'right', panelName: rightPanelName, threadId: rightThreadId }]
    : [];

  const rightQuickSendTargets: QuickSendTarget[] = leftThreadId
    ? [{ panelId: 'left', panelName: leftPanelName, threadId: leftThreadId }]
    : [];

  // Quick-send: Handle quick-send from left panel
  const handleLeftQuickSend = useCallback(
    async (targetPanelId: 'left' | 'right', message: string) => {
      if (targetPanelId === 'right' && rightSendMessageRef.current) {
        console.log(`[QuickSend] Sending from ${leftPanelName} to ${rightPanelName}:`, message);
        try {
          await rightSendMessageRef.current(message, []);
        } catch (error) {
          console.error(`[QuickSend] Failed to send to ${rightPanelName}:`, error);
        }
      }
    },
    [leftPanelName, rightPanelName]
  );

  // Quick-send: Handle quick-send from right panel
  const handleRightQuickSend = useCallback(
    async (targetPanelId: 'left' | 'right', message: string) => {
      if (targetPanelId === 'left' && leftSendMessageRef.current) {
        console.log(`[QuickSend] Sending from ${rightPanelName} to ${leftPanelName}:`, message);
        try {
          await leftSendMessageRef.current(message, []);
        } catch (error) {
          console.error(`[QuickSend] Failed to send to ${leftPanelName}:`, error);
        }
      }
    },
    [leftPanelName, rightPanelName]
  );

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
                title="Enable workflow mode: Main chat can send instructions to New chat"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                  />
                </svg>
                {crossChatEnabled ? 'Workflow Mode ON' : 'Workflow Mode OFF'}
              </button>
            )}
            {crossChatEnabled && (
              <div className="flex items-center gap-1 rounded-md border border-slate-600 bg-slate-800 overflow-hidden">
                <button
                  onClick={() => onMessageTypeChange('instruction')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    messageType === 'instruction'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-200 hover:bg-slate-700'
                  }`}
                  title="Instruction mode: Task-oriented, minimal response"
                >
                  Instruction
                </button>
                <button
                  onClick={() => onMessageTypeChange('chat')}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    messageType === 'chat'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-200 hover:bg-slate-700'
                  }`}
                  title="Chat mode: Conversational, expects response"
                >
                  Chat
                </button>
              </div>
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
              isMainChat={true}
              panelName={leftPanelName}
              otherPanelName={rightPanelName}
              onPanelNameChange={onLeftPanelNameChange}
              messageType={messageType}
              quickSendTargets={leftQuickSendTargets}
              onQuickSend={handleLeftQuickSend}
              currentPanelId="left"
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
              isMainChat={false}
              panelName={rightPanelName}
              otherPanelName={leftPanelName}
              onPanelNameChange={onRightPanelNameChange}
              messageType={messageType}
              quickSendTargets={rightQuickSendTargets}
              onQuickSend={handleRightQuickSend}
              currentPanelId="right"
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
