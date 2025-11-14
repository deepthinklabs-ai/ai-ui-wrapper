/**
 * Chat Panel Component
 *
 * Reusable chat panel for split view feature.
 * Contains messages, composer, and all chat functionality.
 */

"use client";

import React, { useRef, useCallback, useEffect } from "react";
import type { AIModel } from "@/lib/apiKeyStorage";
import type { UserTier } from "@/hooks/useUserTier";
import MessageList from "@/components/dashboard/MessageList";
import MessageComposer from "@/components/dashboard/MessageComposer";
import RevertUndoButton from "@/components/dashboard/RevertUndoButton";
import RevertWithDraftUndoButton from "@/components/dashboard/RevertWithDraftUndoButton";
import { useMessages } from "@/hooks/useMessages";
import { useMessageComposition } from "@/hooks/useMessageComposition";
import { useMessageActions } from "@/hooks/useMessageActions";
import { useRevertWithDraft } from "@/hooks/useRevertWithDraft";
import { useTextConversion } from "@/hooks/useTextConversion";
import { useStepByStepMode } from "@/hooks/useStepByStepMode";
import type { Thread } from "@/types/chat";

interface ChatPanelProps {
  threadId: string | null;
  thread: Thread | null;
  userId: string | undefined;
  userTier: UserTier;
  selectedModel: AIModel;
  onModelChange: (model: AIModel) => void;
  onThreadTitleUpdated?: () => void;
  onCreateThread: () => Promise<string | null>;
  onForkThread?: (fromThreadId: string, fromMessageId: string, newTitle?: string) => Promise<string | null>;
  isFeatureEnabled?: (feature: string) => boolean;
  showHeader?: boolean;
  headerTitle?: string;
  onAIResponse?: (content: string) => void; // Called when AI responds (for cross-chat)
  crossChatEnabled?: boolean; // Whether cross-chat is active
  exposeSendMessage?: (sendFn: (message: string, files: File[]) => Promise<void>) => void; // Expose sendMessage function
}

export default function ChatPanel({
  threadId,
  thread,
  userId,
  userTier,
  selectedModel,
  onModelChange,
  onThreadTitleUpdated,
  onCreateThread,
  onForkThread,
  isFeatureEnabled = () => true,
  showHeader = true,
  headerTitle,
  onAIResponse,
  crossChatEnabled = false,
  exposeSendMessage,
}: ChatPanelProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Step-by-step mode
  const {
    isStepByStepWithExplanation,
    isStepByStepNoExplanation,
    toggleStepByStepWithExplanation,
    toggleStepByStepNoExplanation,
    getSystemPromptAddition,
  } = useStepByStepMode();

  // Messages
  const {
    messages,
    loadingMessages,
    messagesError,
    sendInFlight,
    summarizeInFlight,
    sendMessage,
    summarizeThread,
    refreshMessages,
  } = useMessages(threadId, {
    onThreadTitleUpdated,
    systemPromptAddition: getSystemPromptAddition(),
    userTier,
    userId,
  });

  // Message composition
  const { draft, setDraft, attachedFiles, setAttachedFiles, handleSend } =
    useMessageComposition({
      selectedThreadId: threadId,
      sendMessage,
      createThread: onCreateThread,
    });

  // Text conversion
  const {
    convertingToMarkdown,
    convertingToJson,
    convertToMarkdown,
    convertToJson,
  } = useTextConversion({
    onTextConverted: (convertedText) => setDraft(convertedText),
    userTier,
    userId,
  });

  const handleConvertToMarkdown = useCallback(() => convertToMarkdown(draft), [draft, convertToMarkdown]);
  const handleConvertToJson = useCallback(() => convertToJson(draft), [draft, convertToJson]);

  // Message actions
  const {
    revertInFlight,
    forkFromMessageInFlight,
    handleRevertToMessage,
    handleForkFromMessage,
    canUndoRevert,
    undoRevertInFlight,
    handleUndoRevert,
  } = useMessageActions({
    threadId,
    currentThreadTitle: thread?.title ?? null,
    messages,
    refreshMessages,
    forkThread: onForkThread || (async () => null),
    refreshThreads: onThreadTitleUpdated || (() => {}),
    onModelChange,
    currentModel: selectedModel,
  });

  // Revert with draft
  const {
    revertWithDraftInFlight,
    handleRevertWithDraft: handleRevertWithDraftCore,
    canUndoRevertWithDraft,
    undoRevertWithDraftInFlight,
    handleUndoRevertWithDraft,
  } = useRevertWithDraft({
    threadId,
    messages,
    refreshMessages,
    onModelChange,
    onDraftChange: setDraft,
    onAttachmentsChange: setAttachedFiles,
    currentModel: selectedModel,
    currentDraft: draft,
  });

  // Operation guards
  const isMessageOperationInProgress = revertInFlight || forkFromMessageInFlight || revertWithDraftInFlight;

  const handleRevertToMessageGuarded = useCallback(
    async (messageId: string, switchToOriginalModel: boolean) => {
      if (isMessageOperationInProgress) return;
      await handleRevertToMessage(messageId, switchToOriginalModel);
    },
    [isMessageOperationInProgress, handleRevertToMessage]
  );

  const handleRevertWithDraftGuarded = useCallback(
    async (messageId: string, switchToOriginalModel: boolean) => {
      if (isMessageOperationInProgress) return;
      await handleRevertWithDraftCore(messageId, switchToOriginalModel);
    },
    [isMessageOperationInProgress, handleRevertWithDraftCore]
  );

  const handleForkFromMessageGuarded = useCallback(
    async (messageId: string) => {
      if (isMessageOperationInProgress) return;
      await handleForkFromMessage(messageId);
    },
    [isMessageOperationInProgress, handleForkFromMessage]
  );

  // Cross-chat: Detect new AI responses and relay to other panel
  const lastMessageCountRef = useRef(0);
  useEffect(() => {
    if (!crossChatEnabled || !onAIResponse) return;

    // Check if new assistant message was added
    if (messages.length > lastMessageCountRef.current) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === "assistant") {
        // New AI response - relay to other panel
        onAIResponse(lastMessage.content);
      }
    }

    lastMessageCountRef.current = messages.length;
  }, [messages, crossChatEnabled, onAIResponse]);

  // Expose sendMessage function to parent for cross-chat
  useEffect(() => {
    if (exposeSendMessage && sendMessage) {
      const wrappedSendMessage = async (message: string, files: File[]) => {
        // Send the message using the internal sendMessage
        await sendMessage(message, files);
      };
      exposeSendMessage(wrappedSendMessage);
    }
  }, [exposeSendMessage, sendMessage]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      {showHeader && (
        <div className="flex-shrink-0 border-b border-slate-800 px-4 py-3">
          <h2 className="text-lg font-semibold text-slate-200">
            {headerTitle || thread?.title || "New Chat"}
          </h2>
        </div>
      )}

      {/* Error display */}
      {messagesError && (
        <div className="flex-shrink-0 mx-4 mt-3 rounded-md border border-red-700 bg-red-900/20 px-4 py-2 text-sm text-red-400">
          {messagesError}
        </div>
      )}

      {/* Chat card: messages + composer */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-lg m-3">
        {/* Messages list (scrolls) */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-4"
        >
          <MessageList
            messages={messages}
            loading={loadingMessages}
            thinking={sendInFlight || summarizeInFlight}
            currentModel={selectedModel}
            onRevertToMessage={handleRevertToMessageGuarded}
            onRevertWithDraft={handleRevertWithDraftGuarded}
            onForkFromMessage={handleForkFromMessageGuarded}
            messageActionsDisabled={isMessageOperationInProgress}
            isFeatureEnabled={isFeatureEnabled}
          />
        </div>

        {/* Undo buttons */}
        <div className="border-t border-slate-800/50">
          <RevertUndoButton
            canUndo={canUndoRevert}
            undoInFlight={undoRevertInFlight}
            onUndo={handleUndoRevert}
          />
          <RevertWithDraftUndoButton
            canUndo={canUndoRevertWithDraft}
            undoInFlight={undoRevertWithDraftInFlight}
            onUndo={handleUndoRevertWithDraft}
          />
        </div>

        {/* Composer */}
        <div className="border-t border-slate-800 px-4 py-3">
          <MessageComposer
            value={draft}
            onChange={setDraft}
            onSend={handleSend}
            disabled={sendInFlight}
            selectedModel={selectedModel}
            onModelChange={onModelChange}
            onSummarize={() => {}}
            onSummarizeAndContinue={() => {}}
            onFork={() => {}}
            canSummarize={false}
            summarizing={false}
            summarizingAndContinuing={false}
            forking={false}
            attachedFiles={attachedFiles}
            onFilesChange={setAttachedFiles}
            onConvertToMarkdown={handleConvertToMarkdown}
            onConvertToJson={handleConvertToJson}
            convertingToMarkdown={convertingToMarkdown}
            convertingToJson={convertingToJson}
            isStepByStepWithExplanation={isStepByStepWithExplanation}
            isStepByStepNoExplanation={isStepByStepNoExplanation}
            onToggleStepByStepWithExplanation={toggleStepByStepWithExplanation}
            onToggleStepByStepNoExplanation={toggleStepByStepNoExplanation}
            userTier={userTier}
            isFeatureEnabled={isFeatureEnabled}
          />
        </div>
      </div>
    </div>
  );
}
