"use client";

import React, { useEffect, useRef, useState, useCallback, type RefObject } from "react";
import { redirect } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useThreads } from "@/hooks/useThreads";
import { useFolders } from "@/hooks/useFolders";
import { useEncryptedMessages } from "@/hooks/useEncryptedMessages";
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
import { useSplitView } from "@/hooks/useSplitView";
import { useThreadContext } from "@/hooks/useThreadContext";
import { useResizableSidebar } from "@/hooks/useResizableSidebar";
import { useMCPServers } from "@/hooks/useMCPServers";
import { useExposedWorkflows } from "@/hooks/useExposedWorkflows";
import { getSelectedModel, setSelectedModel, type AIModel, AVAILABLE_MODELS } from "@/lib/apiKeyStorage";
import { supabase } from "@/lib/supabaseClient";
import Sidebar from "@/components/dashboard/Sidebar";
import ChatHeader from "@/components/dashboard/ChatHeader";
import MessageList from "@/components/dashboard/MessageList";
import MessageComposer from "@/components/dashboard/MessageComposer";
import MCPServerIndicator from "@/components/dashboard/MCPServerIndicator";
import RevertUndoButton from "@/components/dashboard/RevertUndoButton";
import RevertWithDraftUndoButton from "@/components/dashboard/RevertWithDraftUndoButton";
import ContextWindowIndicator from "@/components/dashboard/ContextWindowIndicator";
import TextSelectionPopup from "@/components/contextPanel/TextSelectionPopup";
import ContextPanel from "@/components/contextPanel/ContextPanel";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import SplitChatView from "@/components/splitView/SplitChatView";

export default function DashboardPage() {
  const { user, loadingUser, error: userError, signOut } = useAuthSession();
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // User tier for freemium limits
  const { tier, refreshTier } = useUserTier(user?.id);

  // Verify subscription on upgrade success redirect
  useEffect(() => {
    const verifyUpgrade = async () => {
      if (!user?.id) return;

      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('upgrade') === 'success') {
        try {
          // Call verify API to sync subscription status
          const response = await fetch('/api/stripe/verify-subscription', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.id }),
          });

          const data = await response.json();
          console.log('[Dashboard] Subscription verification:', data);

          if (data.verified && data.tier === 'pro') {
            // Refresh the tier from database
            await refreshTier();
          }

          // Clean up URL
          window.history.replaceState({}, '', '/dashboard');
        } catch (error) {
          console.error('[Dashboard] Error verifying subscription:', error);
        }
      }
    };

    verifyUpgrade();
  }, [user?.id, refreshTier]);

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

  // Web search toggle
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const toggleWebSearch = useCallback(() => {
    setEnableWebSearch(prev => !prev);
  }, []);

  // Auto-clear API key on logout for security
  useApiKeyCleanup();

  // Load feature toggles
  const { isFeatureEnabled } = useFeatureToggles(user?.id);

  // Split view feature
  const {
    splitView,
    activateSplitView,
    deactivateSplitView,
    swapPanels,
    setLeftThread,
    setRightThread,
    toggleCrossChat,
    setLeftPanelName,
    setRightPanelName,
    setMessageType,
  } = useSplitView();

  // Thread context - allows adding .thread files to context panel for AI questions
  const {
    threadContextSections,
    isLoadingThread,
    addThreadToContext,
    removeThreadFromContext,
    getContextStrings: getThreadContextStrings,
  } = useThreadContext();

  // Create a Set of thread IDs in context for quick lookup
  const threadContextIds = React.useMemo(
    () => new Set(threadContextSections.map((s) => s.threadId)),
    [threadContextSections]
  );

  // MCP servers
  const { connections, tools, isConnecting, servers, isEnabled } = useMCPServers();

  // Resizable sidebar
  const { isResizing, handleMouseDown: handleSidebarResize, sidebarStyle } = useResizableSidebar();

  // Exposed workflows for Master Trigger feature
  const {
    workflows,
    selectedWorkflow,
    selectWorkflow,
    triggerWorkflow,
    isLoading: workflowsLoading,
    isExecuting: workflowExecuting,
  } = useExposedWorkflows(user?.id || null);

  // Debug MCP status
  useEffect(() => {
    console.log('[Dashboard MCP Status]', {
      isEnabled,
      serversConfigured: servers.length,
      connections: connections.length,
      tools: tools.length,
      isConnecting
    });
  }, [isEnabled, servers.length, connections.length, tools.length, isConnecting]);

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

  // Folder management
  const {
    folderTree,
    createFolder,
    updateFolder,
    deleteFolder,
    moveFolder,
    moveThread,
    bulkMoveThreads,
    toggleFolderCollapse,
    refreshFolders,
  } = useFolders(user?.id, threads, {
    onThreadMoved: refreshThreads,
  });

  const {
    messages,
    loadingMessages,
    messagesError,
    encryptionError,
    sendInFlight,
    summarizeInFlight,
    isEncryptionReady,
    sendMessage,
    summarizeThread,
    generateSummary,
    refreshMessages,
  } = useEncryptedMessages(selectedThreadId, {
    onThreadTitleUpdated: refreshThreads,
    systemPromptAddition: getSystemPromptAddition(),
    userTier: tier,
    userId: user?.id,
    enableWebSearch,
  });

  const currentThread =
    threads.find((t) => t.id === selectedThreadId) ?? null;

  // Text selection detection
  const { selection, clearSelection } = useTextSelection(messagesContainerRef as RefObject<HTMLElement>);

  // Message composition (draft, files, send handler)
  const { draft, setDraft, attachedFiles, setAttachedFiles, handleSend: originalHandleSend } =
    useMessageComposition({
      selectedThreadId,
      sendMessage,
      createThread,
      onThreadCreated: refreshFolders, // Refresh folders to show newly created default folder
    });

  // Workflow-aware send handler - routes to workflow or regular chat
  const handleSend = useCallback(async () => {
    if (selectedWorkflow && user?.id) {
      // Route through workflow
      const content = draft.trim();
      if (!content && attachedFiles.length === 0) return;

      // Convert files to workflow attachment format
      const workflowAttachments = await Promise.all(
        attachedFiles.map(async (file) => {
          const content = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              // Extract base64 data for images, raw content for text
              if (file.type.startsWith('image/')) {
                resolve(result.split(',')[1]); // Remove data:mime;base64, prefix
              } else {
                resolve(result);
              }
            };
            if (file.type.startsWith('image/')) {
              reader.readAsDataURL(file);
            } else {
              reader.readAsText(file);
            }
          });

          return {
            name: file.name,
            type: file.type,
            size: file.size,
            content,
            isImage: file.type.startsWith('image/'),
          };
        })
      );

      // Clear draft and files
      const draftToSend = draft;
      setDraft('');
      setAttachedFiles([]);

      // Build conversation history from thread messages for workflow context
      const conversationHistory = messages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      // Trigger workflow with conversation history
      const output = await triggerWorkflow({
        message: draftToSend,
        attachments: workflowAttachments.length > 0 ? workflowAttachments : undefined,
        userId: user.id,
        threadId: selectedThreadId || undefined,
        model: selectedModel,
        timestamp: new Date().toISOString(),
        conversationHistory, // Pass thread history for context
      });

      // Display response in chat if we have a thread
      if (output && output.success && selectedThreadId) {
        console.log('[Dashboard] Workflow succeeded, displaying response in chat');

        // Insert user message directly to DB (without calling AI)
        const { error: userMsgError } = await supabase
          .from("messages")
          .insert({
            thread_id: selectedThreadId,
            role: "user",
            content: draftToSend,
            model: null,
            attachments: workflowAttachments.length > 0 ? workflowAttachments : null,
          });

        if (userMsgError) {
          console.error('[Dashboard] Failed to insert user message:', userMsgError);
        }

        // Insert workflow response as assistant message
        const { error: assistantMsgError } = await supabase
          .from("messages")
          .insert({
            thread_id: selectedThreadId,
            role: "assistant",
            content: output.response,
            model: `workflow:${selectedWorkflow.displayName}`,
          });

        if (assistantMsgError) {
          console.error('[Dashboard] Failed to insert workflow response:', assistantMsgError);
        }

        // Refresh messages to show the new messages
        await refreshMessages();
        console.log('[Dashboard] Workflow response displayed successfully');
      } else if (output && !output.success) {
        console.error('[Dashboard] Workflow failed:', output.error);
      }
    } else {
      // Regular chat flow
      await originalHandleSend();
    }
  }, [selectedWorkflow, user?.id, draft, attachedFiles, triggerWorkflow, selectedThreadId, selectedModel, originalHandleSend, setDraft, setAttachedFiles, refreshMessages, messages]);

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
    setIsContextPanelOpen,
    selectedContextSections,
    handleAddContext,
    handleRemoveContextSection: handleRemoveTextContextSection,
    handleCloseContextPanel: handleCloseTextContextPanel,
    handleContextSubmit,
  } = useContextPanel({
    selection,
    clearSelection,
    threadMessages: messages.map(m => ({ role: m.role as "user" | "assistant", content: m.content })),
    userTier: tier,
    userId: user?.id,
  });

  // Combine text selection context with thread context
  const threadContextStrings = getThreadContextStrings();
  const combinedContextSections = React.useMemo(
    () => [...selectedContextSections, ...threadContextStrings],
    [selectedContextSections, threadContextStrings]
  );

  // Wrapper to add thread to context and open panel
  const handleAddThreadToContext = useCallback(async (threadId: string, threadTitle: string) => {
    await addThreadToContext(threadId, threadTitle);
    setIsContextPanelOpen(true);
  }, [addThreadToContext, setIsContextPanelOpen]);

  // Combined removal handler that knows whether to remove from text or thread context
  const handleRemoveContextSection = useCallback((index: number) => {
    const textSectionCount = selectedContextSections.length;
    if (index < textSectionCount) {
      // It's a text selection section
      handleRemoveTextContextSection(index);
    } else {
      // It's a thread context section
      const threadIndex = index - textSectionCount;
      const threadSection = threadContextSections[threadIndex];
      if (threadSection) {
        removeThreadFromContext(threadSection.threadId);
      }
    }
  }, [selectedContextSections.length, handleRemoveTextContextSection, threadContextSections, removeThreadFromContext]);

  // Combined close handler
  const handleCloseContextPanel = useCallback(() => {
    handleCloseTextContextPanel();
    // Clear thread context when closing panel
    threadContextSections.forEach((s) => removeThreadFromContext(s.threadId));
  }, [handleCloseTextContextPanel, threadContextSections, removeThreadFromContext]);

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
    return <OnboardingFlow userId={user.id} userEmail={user.email} onComplete={markOnboardingComplete} />;
  }

  return (
    <div className="flex flex-row h-screen bg-slate-950 text-slate-50">
      {/* LEFT: sidebar column */}
      <aside
        className="h-screen flex-shrink-0 border-r border-slate-800 bg-slate-950 relative"
        style={sidebarStyle}
      >
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
          // Folder props
          folderTree={folderTree}
          onCreateFolder={createFolder}
          onUpdateFolder={updateFolder}
          onDeleteFolder={deleteFolder}
          onMoveFolder={moveFolder}
          onMoveThread={moveThread}
          onBulkMoveThreads={bulkMoveThreads}
          onToggleFolderCollapse={toggleFolderCollapse}
          // Thread context props
          threadContextIds={threadContextIds}
          onAddThreadToContext={handleAddThreadToContext}
        />
        {/* Resize handle */}
        <div
          onMouseDown={handleSidebarResize}
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-blue-500/50 transition-colors ${
            isResizing ? "bg-blue-500/50" : "bg-transparent"
          }`}
          title="Drag to resize sidebar"
        />
      </aside>

      {/* RIGHT: chat column */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {splitView.isActive ? (
          /* Split View Mode */
          <SplitChatView
            leftThreadId={splitView.leftThreadId}
            rightThreadId={splitView.rightThreadId}
            threads={threads}
            userId={user?.id}
            userTier={tier}
            selectedModel={selectedModel}
            onModelChange={handleModelChange}
            onThreadTitleUpdated={refreshThreads}
            onCreateThread={createThread}
            onClose={deactivateSplitView}
            onSwapPanels={swapPanels}
            onSelectLeftThread={setLeftThread}
            onSelectRightThread={setRightThread}
            isFeatureEnabled={isFeatureEnabled as (feature: string) => boolean}
            initialSplitRatio={splitView.splitRatio}
            crossChatEnabled={splitView.crossChatEnabled}
            onToggleCrossChat={toggleCrossChat}
            leftPanelName={splitView.leftPanelName}
            rightPanelName={splitView.rightPanelName}
            onLeftPanelNameChange={setLeftPanelName}
            onRightPanelNameChange={setRightPanelName}
            messageType={splitView.messageType}
            onMessageTypeChange={setMessageType}
          />
        ) : (
          /* Normal Single Chat View */
          <>
            {/* Centered chat area, like ChatGPT */}
            <div className="flex h-full w-full justify-center overflow-hidden">
              <div className="flex h-full w-3/4 flex-col gap-3 px-4 py-4 overflow-hidden">
                {/* Header at top of chat column with Split View button and MCP indicator */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <ChatHeader currentThreadTitle={currentThread?.title ?? null} />
                    <MCPServerIndicator
                      connections={connections}
                      tools={tools}
                      isConnecting={isConnecting}
                    />
                  </div>
                  {selectedThreadId && (
                    <button
                      onClick={() => activateSplitView(selectedThreadId, null)}
                      className="flex-shrink-0 rounded-md border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors flex items-center gap-2"
                      title="Open split view"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 4H5a2 2 0 00-2 2v14a2 2 0 002 2h4m0-18v18m0-18l7-2v18l-7 2"
                        />
                      </svg>
                      Split View
                    </button>
                  )}
                </div>

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
                  disabled={sendInFlight || workflowExecuting}
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
                  enableWebSearch={enableWebSearch}
                  onToggleWebSearch={toggleWebSearch}
                  userTier={tier}
                  isFeatureEnabled={isFeatureEnabled}
                  workflows={workflows}
                  selectedWorkflow={selectedWorkflow}
                  onWorkflowChange={selectWorkflow}
                  workflowsLoading={workflowsLoading}
                  workflowExecuting={workflowExecuting}
                />
              </div>
            </section>
          </div>
        </div>
          </>
        )}
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
          contextSections={combinedContextSections}
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
