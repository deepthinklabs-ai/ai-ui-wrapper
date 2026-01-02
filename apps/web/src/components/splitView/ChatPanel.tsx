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
import QuickSendButtons from "@/components/splitView/QuickSendButtons";
import { useMessages } from "@/hooks/useMessages";
import { useMessageComposition } from "@/hooks/useMessageComposition";
import { useMessageActions } from "@/hooks/useMessageActions";
import { useRevertWithDraft } from "@/hooks/useRevertWithDraft";
import { useTextConversion } from "@/hooks/useTextConversion";
import { useStepByStepMode } from "@/hooks/useStepByStepMode";
import type { Thread } from "@/types/chat";
import type { MessageType, QuickSendTarget } from "@/types/splitView";

interface ChatPanelProps {
  threadId: string | null;
  thread: Thread | null;
  userId?: string | undefined; // Deprecated - no longer used, auth is handled internally
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
  isMainChat?: boolean; // Is this the main (left) chat panel?
  panelName?: string; // Custom name for this panel
  otherPanelName?: string; // Name of the other panel (for system prompt)
  onPanelNameChange?: (newName: string) => void; // Callback when name is edited
  messageType?: MessageType; // Type of message being sent
  quickSendTargets?: QuickSendTarget[]; // Available targets for quick-send buttons
  onQuickSend?: (targetPanelId: 'left' | 'right', message: string) => void; // Handler for quick-send
  currentPanelId?: 'left' | 'right'; // Current panel ID for quick-send
}

export default function ChatPanel({
  threadId,
  thread,
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
  isMainChat = false,
  panelName = "Chat",
  otherPanelName = "Other Chat",
  onPanelNameChange,
  messageType = "instruction",
  quickSendTargets = [],
  onQuickSend,
  currentPanelId = 'left',
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

  // Web search toggle
  const [enableWebSearch, setEnableWebSearch] = React.useState(true);
  const toggleWebSearch = useCallback(() => {
    setEnableWebSearch(prev => !prev);
  }, []);

  // Build system prompt with workflow mode instructions
  const buildSystemPrompt = useCallback(() => {
    let prompt = getSystemPromptAddition();

    // Add workflow mode instructions
    if (crossChatEnabled && isMainChat) {
      if (messageType === 'instruction') {
        const workflowInstruction = `\n\nWORKFLOW MODE (INSTRUCTION): You are "${panelName}" in a split-view interface. When the user asks you to send a message or instruction to "${otherPanelName}", your ENTIRE response will be automatically sent to them. DO NOT format it as a message or add any meta-commentary. Just write EXACTLY what you want ${otherPanelName} to receive. For example, if the user says "send a message to ${otherPanelName}: hello world", you should respond ONLY with "hello world" - nothing else. Your response IS the message that will be sent. ${otherPanelName} is in INSTRUCTION MODE and will execute without responding unless they need clarification.`;
        prompt += workflowInstruction;
      } else {
        const workflowInstruction = `\n\nWORKFLOW MODE (CHAT): You are "${panelName}" in a split-view interface. When the user asks you to send a message to "${otherPanelName}", your ENTIRE response will be automatically sent to them. DO NOT format it as a message or add any meta-commentary. Just write EXACTLY what you want ${otherPanelName} to receive. Your response IS the message. ${otherPanelName} is in CHAT MODE and will respond conversationally once, then wait for user feedback.`;
        prompt += workflowInstruction;
      }
    } else if (crossChatEnabled && !isMainChat) {
      if (messageType === 'instruction') {
        const workflowInstruction = `\n\nWORKFLOW MODE (INSTRUCTION): You are "${panelName}" - a fully capable AI assistant with all standard capabilities including web search, code execution, and any tools you normally have access to. You may receive instructions from "${otherPanelName}" (visible on the left). These will be marked with "[Instruction from ${otherPanelName}]". The user will refer to you as "${panelName}" and the other AI as "${otherPanelName}". Work on these instructions independently using ALL your available capabilities. DO NOT respond back to ${otherPanelName} unless you genuinely need clarifying questions for accuracy. Execute the task, show your work to the user, and use any tools/capabilities you need to complete the task.`;
        prompt += workflowInstruction;
      } else {
        const workflowInstruction = `\n\nWORKFLOW MODE (CHAT): You are "${panelName}" - a fully capable AI assistant with all standard capabilities. You may receive messages from "${otherPanelName}" (visible on the left). These will be marked with "[Chat from ${otherPanelName}]". The user will refer to you as "${panelName}" and the other AI as "${otherPanelName}". Respond conversationally to ${otherPanelName} using all your available capabilities. After your FIRST response, STOP and wait for the user to provide feedback or guidance before continuing the conversation.`;
        prompt += workflowInstruction;
      }
    }

    return prompt;
  }, [getSystemPromptAddition, crossChatEnabled, isMainChat, panelName, otherPanelName, messageType]);

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
    systemPromptAddition: buildSystemPrompt(),
    userTier,
    enableWebSearch,
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
    forkThread: onForkThread as any || (async () => null),
    refreshThreads: onThreadTitleUpdated as any || (async () => {}),
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
  const isInitialLoadRef = useRef(true);
  const lastCrossChatStateRef = useRef(crossChatEnabled);

  useEffect(() => {
    // Initialize the ref when messages first load
    if (isInitialLoadRef.current && messages.length > 0) {
      lastMessageCountRef.current = messages.length;
      isInitialLoadRef.current = false;
      return; // Don't relay on initial load
    }

    // If workflow mode just got enabled, update the count to prevent relaying old messages
    if (crossChatEnabled && !lastCrossChatStateRef.current) {
      lastMessageCountRef.current = messages.length;
      lastCrossChatStateRef.current = crossChatEnabled;
      return; // Don't relay when workflow mode is first enabled
    }

    lastCrossChatStateRef.current = crossChatEnabled;

    if (!crossChatEnabled || !onAIResponse) return;

    // Only detect truly NEW messages (count increased)
    if (messages.length > lastMessageCountRef.current) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === "assistant") {
        // New AI response - relay to other panel
        onAIResponse(lastMessage.content);
      }
    }

    lastMessageCountRef.current = messages.length;
  }, [messages, crossChatEnabled, onAIResponse]);

  // Reset initial load flag when thread changes
  useEffect(() => {
    isInitialLoadRef.current = true;
    lastMessageCountRef.current = 0;
  }, [threadId]);

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
        <div className="flex-shrink-0 border-b border-white/30 px-4 py-3">
          <h2 className="text-lg font-semibold text-foreground">
            {headerTitle || thread?.title || "New Chat"}
          </h2>
        </div>
      )}

      {/* Panel Name Editor */}
      <div className="flex-shrink-0 border-b border-white/20 bg-white/20 backdrop-blur-sm px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground/60">Panel Name:</span>
          <input
            type="text"
            value={panelName}
            onChange={(e) => onPanelNameChange?.(e.target.value)}
            className="flex-1 rounded-lg border border-white/40 bg-white/60 px-2 py-1 text-sm text-foreground placeholder-foreground/40 focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky"
            placeholder="Enter panel name..."
          />
        </div>
      </div>

      {/* Error display */}
      {messagesError && (
        <div className="flex-shrink-0 mx-4 mt-3 rounded-lg border border-red-300 bg-red-100/80 backdrop-blur-sm px-4 py-2 text-sm text-red-700">
          {messagesError}
        </div>
      )}

      {/* Chat card: messages + composer */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/40 bg-white/40 backdrop-blur-md shadow-lg m-3">
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
        <div className="border-t border-white/20">
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

        {/* Quick Send Buttons */}
        {quickSendTargets.length > 0 && onQuickSend && (
          <QuickSendButtons
            targets={quickSendTargets}
            currentDraft={draft}
            onQuickSend={onQuickSend}
            disabled={sendInFlight}
            currentPanelId={currentPanelId}
          />
        )}

        {/* Composer */}
        <div className="border-t border-white/30 px-4 py-3">
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
            enableWebSearch={enableWebSearch}
            onToggleWebSearch={toggleWebSearch}
            userTier={userTier}
            isFeatureEnabled={isFeatureEnabled}
          />
        </div>
      </div>
    </div>
  );
}
