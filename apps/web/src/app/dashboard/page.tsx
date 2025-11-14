"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { redirect } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useThreads } from "@/hooks/useThreads";
import { useMessages } from "@/hooks/useMessages";
import { useUserTier, TIER_LIMITS } from "@/hooks/useUserTier";
import { useTextSelection } from "@/hooks/useTextSelection";
import { useThreadOperations } from "@/hooks/useThreadOperations";
import { useContextPanel } from "@/hooks/useContextPanel";
import { useMessageComposition } from "@/hooks/useMessageComposition";
import { useMessageActions } from "@/hooks/useMessageActions";
import { useContextToMainChat } from "@/hooks/useContextToMainChat";
import { useRevertWithDraft } from "@/hooks/useRevertWithDraft";
import { useTextConversion } from "@/hooks/useTextConversion";
import { useStepByStepMode } from "@/hooks/useStepByStepMode";
import { useApiKeyCleanup } from "@/hooks/useApiKeyCleanup";
import { useContextWindow } from "@/hooks/useContextWindow";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { useFeatureToggles } from "@/hooks/useFeatureToggles";
import { getSelectedModel, setSelectedModel, type AIModel, AVAILABLE_MODELS } from "@/lib/apiKeyStorage";
import Sidebar from "@/components/dashboard/Sidebar";
import ChatHeader from "@/components/dashboard/ChatHeader";
import MessageList from "@/components/dashboard/MessageList";
import MessageComposer from "@/components/dashboard/MessageComposer";
import RevertUndoButton from "@/components/dashboard/RevertUndoButton";
import RevertWithDraftUndoButton from "@/components/dashboard/RevertWithDraftUndoButton";
import ContextWindowIndicator from "@/components/dashboard/ContextWindowIndicator";
import TextSelectionPopup from "@/components/contextPanel/TextSelectionPopup";
import ContextPanel from "@/components/contextPanel/ContextPanel";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";

export default function DashboardPage() {
  const { user, loadingUser, error: userError, signOut } = useAuthSession();
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // User tier for freemium limits
  const { tier } = useUserTier(user?.id);

  // Onboarding status
  const { needsOnboarding, loading: onboardingLoading, markOnboardingComplete } = useOnboardingStatus(user?.id);

  // Model selection state
  const [selectedModel, setSelectedModelState] = useState<AIModel>(() => getSelectedModel());

  const handleModelChange = useCallback((model: AIModel) => {
    setSelectedModelState(model);
    setSelectedModel(model); // Persist to localStorage
  }, []);

  // Step-by-step mode
  const {
    isStepByStepWithExplanation,
    isStepByStepNoExplanation,
    toggleStepByStepWithExplanation,
    toggleStepByStepNoExplanation,
    getSystemPromptAddition,
  } = useStepByStepMode();

  // Auto-clear API key on logout for security
  useApiKeyCleanup();

  // Load feature toggles
  const { isFeatureEnabled } = useFeatureToggles(user?.id);

  useEffect(() => {
    if (!loadingUser && !user) {
      redirect("/auth");
    }
  }, [loadingUser, user]);

  const {
    threads,
    loadingThreads,
    threadsError,
    selectedThreadId,
    selectThread,
    createThread,
    createThreadWithContext,
    forkThread,
    deleteThread,
    updateThreadTitle,
    refreshThreads,
    canCreateThread,
    threadLimitReached,
  } = useThreads(user?.id);

  const {
    messages,
    loadingMessages,
    messagesError,
    sendInFlight,
    summarizeInFlight,
    sendMessage,
    summarizeThread,
    generateSummary,
    refreshMessages,
  } = useMessages(selectedThreadId, {
    onThreadTitleUpdated: refreshThreads,
    systemPromptAddition: getSystemPromptAddition(),
    userTier: tier,
    userId: user?.id,
  });

  const currentThread =
    threads.find((t) => t.id === selectedThreadId) ?? null;

  // Text selection detection
  const { selection, clearSelection } = useTextSelection(messagesContainerRef);

  // Message composition (draft, files, send handler)
  const { draft, setDraft, attachedFiles, setAttachedFiles, handleSend } =
    useMessageComposition({
      selectedThreadId,
      sendMessage,
      createThread,
    });

  // Text conversion (convert draft to Markdown or JSON)
  const {
    convertingToMarkdown,
    convertingToJson,
    convertToMarkdown,
    convertToJson,
  } = useTextConversion({
    onTextConverted: (convertedText) => setDraft(convertedText),
    userTier: tier,
    userId: user?.id,
  });

  const handleConvertToMarkdown = useCallback(() => convertToMarkdown(draft), [draft, convertToMarkdown]);
  const handleConvertToJson = useCallback(() => convertToJson(draft), [draft, convertToJson]);

  // Thread operations (fork, summarize, summarize and continue)
  const {
    summarizeAndContinueInFlight,
    forkInFlight,
    handleSummarize,
    handleSummarizeAndContinue,
    handleFork,
  } = useThreadOperations({
    selectedThreadId,
    messages,
    currentThreadTitle: currentThread?.title ?? null,
    generateSummary,
    createThreadWithContext,
    forkThread,
    summarizeThread,
    refreshThreads,
  });

  // Context panel (text selection, context questions)
  const {
    isContextPanelOpen,
    selectedContextSections,
    handleAddContext,
    handleRemoveContextSection,
    handleCloseContextPanel,
    handleContextSubmit,
  } = useContextPanel({
    selection,
    clearSelection,
    threadMessages: messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
  });

  // Context-to-main-chat feature
  const { isAdding: isAddingContextToMainChat, addContextToMainChat } = useContextToMainChat({
    onAddToMainChat: async (contextMessages, contextSections) => {
      if (!selectedThreadId) return;

      // Format context conversation into a summary message
      const contextHeader = contextSections.length > 0
        ? `**Context sections analyzed:**\n${contextSections.map((s, i) => `${i + 1}. ${s.substring(0, 100)}${s.length > 100 ? '...' : ''}`).join('\n')}\n\n`
        : '';

      const conversationSummary = contextMessages
        .map(msg => `**${msg.role === 'user' ? 'Question' : 'Answer'}:** ${msg.content}`)
        .join('\n\n');

      const fullMessage = `${contextHeader}**Context Panel Conversation:**\n\n${conversationSummary}`;

      // Add as a user message to the main chat
      await sendMessage(fullMessage, []);
    },
  });

  // Message actions (revert, fork from message)
  const {
    revertInFlight,
    forkFromMessageInFlight,
    handleRevertToMessage,
    handleForkFromMessage,
    canUndoRevert,
    undoRevertInFlight,
    handleUndoRevert,
  } = useMessageActions({
    threadId: selectedThreadId,
    currentThreadTitle: currentThread?.title ?? null,
    messages,
    refreshMessages,
    forkThread,
    refreshThreads,
    onModelChange: handleModelChange,
    currentModel: selectedModel,
  });

  // Revert with draft (revert and pre-populate composer)
  const {
    revertWithDraftInFlight,
    handleRevertWithDraft: handleRevertWithDraftCore,
    canUndoRevertWithDraft,
    undoRevertWithDraftInFlight,
    handleUndoRevertWithDraft,
  } = useRevertWithDraft({
    threadId: selectedThreadId,
    messages,
    refreshMessages,
    onModelChange: handleModelChange,
    onDraftChange: setDraft,
    onAttachmentsChange: setAttachedFiles,
    currentModel: selectedModel,
    currentDraft: draft,
  });

  // Context window tracking
  const contextWindow = useContextWindow({
    messages,
    currentModel: selectedModel,
  });

  // Get model label for display
  const modelLabel = AVAILABLE_MODELS.find(m => m.value === selectedModel)?.label || selectedModel;

  // Operation guards to prevent concurrent message operations
  const isMessageOperationInProgress = revertInFlight || forkFromMessageInFlight || revertWithDraftInFlight;

  const handleRevertToMessageGuarded = useCallback(async (messageId: string, switchToOriginalModel: boolean) => {
    if (isMessageOperationInProgress) {
      console.warn("Another message operation is in progress, ignoring revert request");
      return;
    }
    await handleRevertToMessage(messageId, switchToOriginalModel);
  }, [isMessageOperationInProgress, handleRevertToMessage]);

  const handleRevertWithDraftGuarded = useCallback(async (messageId: string, switchToOriginalModel: boolean) => {
    if (isMessageOperationInProgress) {
      console.warn("Another message operation is in progress, ignoring revert with draft request");
      return;
    }
    await handleRevertWithDraftCore(messageId, switchToOriginalModel);
  }, [isMessageOperationInProgress, handleRevertWithDraftCore]);

  const handleForkFromMessageGuarded = useCallback(async (messageId: string) => {
    if (isMessageOperationInProgress) {
      console.warn("Another message operation is in progress, ignoring fork request");
      return;
    }
    await handleForkFromMessage(messageId);
  }, [isMessageOperationInProgress, handleForkFromMessage]);

  if (loadingUser || onboardingLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-200">
        Loading…
      </div>
    );
  }

  if (userError) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-red-400">
        Error: {userError}
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Show onboarding for new users
  if (needsOnboarding) {
    return <OnboardingFlow userId={user.id} onComplete={markOnboardingComplete} />;
  }

  return (
    <div className="flex flex-row h-screen bg-slate-950 text-slate-50">
      {/* LEFT: sidebar column */}
      <aside className="w-64 h-screen flex-shrink-0 border-r border-slate-800 bg-slate-950">
        <Sidebar
          userEmail={user.email}
          threads={threads}
          selectedThreadId={selectedThreadId}
          onSelectThread={selectThread}
          onNewThread={createThread}
          onDeleteThread={deleteThread}
          onUpdateThreadTitle={updateThreadTitle}
          onSignOut={signOut}
          canCreateThread={canCreateThread}
          threadLimitReached={threadLimitReached}
          maxThreads={TIER_LIMITS[tier].maxThreads}
          userTier={tier}
        />
      </aside>

      {/* RIGHT: chat column */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Centered chat area, like ChatGPT */}
        <div className="flex h-full w-full justify-center overflow-hidden">
          <div className="flex h-full w-full max-w-3xl flex-col gap-3 px-4 py-4 overflow-hidden">
            {/* Header at top of chat column */}
            <ChatHeader currentThreadTitle={currentThread?.title ?? null} />

            {/* Context Window Indicator - shows token usage */}
            {isFeatureEnabled('context_window_indicator') && selectedThreadId && messages.length > 0 && (
              <ContextWindowIndicator
                totalTokens={contextWindow.totalTokens}
                maxTokens={contextWindow.maxTokens}
                percentage={contextWindow.percentage}
                isNearLimit={contextWindow.isNearLimit}
                isAtLimit={contextWindow.isAtLimit}
                shouldSummarize={contextWindow.shouldSummarize}
                modelLabel={modelLabel}
              />
            )}

            {(loadingThreads || threadsError || messagesError) && (
              <div className="rounded-md border border-slate-700 bg-slate-900/70 px-4 py-2 text-xs text-slate-300">
                {loadingThreads && <span>Loading threads… </span>}
                {threadsError && (
                  <span className="text-red-400">{threadsError} </span>
                )}
                {messagesError && (
                  <span className="text-red-400">{messagesError}</span>
                )}
              </div>
            )}

            {/* Chat card: messages + composer, very clearly separate from sidebar */}
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-lg">
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

              {/* Undo buttons - only one can show at a time */}
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

              {/* Composer stuck to bottom of card */}
              <div className="border-t border-slate-800 px-4 py-3">
                <MessageComposer
                  value={draft}
                  onChange={setDraft}
                  onSend={handleSend}
                  disabled={sendInFlight}
                  selectedModel={selectedModel}
                  onModelChange={handleModelChange}
                  onSummarize={handleSummarize}
                  onSummarizeAndContinue={handleSummarizeAndContinue}
                  onFork={handleFork}
                  canSummarize={!!selectedThreadId && messages.length > 0}
                  summarizing={summarizeInFlight}
                  summarizingAndContinuing={summarizeAndContinueInFlight}
                  forking={forkInFlight}
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
                  userTier={tier}
                  isFeatureEnabled={isFeatureEnabled}
                />
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Text Selection Popup */}
      {isFeatureEnabled('text_selection_popup') && selection && (
        <TextSelectionPopup
          x={selection.x}
          y={selection.y}
          onAddContext={handleAddContext}
          isContextPanelOpen={isContextPanelOpen}
        />
      )}

      {/* Context Panel */}
      {isFeatureEnabled('context_panel') && (
        <ContextPanel
          isOpen={isContextPanelOpen}
          onClose={handleCloseContextPanel}
          contextSections={selectedContextSections}
          onRemoveSection={handleRemoveContextSection}
          threadMessages={messages.map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }))}
          selectedModel={selectedModel}
          onSubmit={handleContextSubmit}
          onAddToMainChat={addContextToMainChat}
          isAddingToMainChat={isAddingContextToMainChat}
        />
      )}
    </div>
  );
}
