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
import { useExposedWorkflows } from "@/hooks/useExposedWorkflows";
import { useBYOKStatus } from "@/hooks/useBYOKStatus";
import { useChatbots, useChatbotFolders, useActiveChatbot } from "@/app/chatbots/hooks";
import type { CreateChatbotInput } from "@/types/chatbot";
import { getSelectedModel, setSelectedModel, type AIModel, AVAILABLE_MODELS } from "@/lib/apiKeyStorage";
import { modelSupportsWebSearch } from "@/lib/modelCapabilities";
import { verifySubscriptionWithRetry, RETRY_STRATEGIES } from "@/lib/services/subscriptionService";
import { supabase } from "@/lib/supabaseClient";
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
import SplitChatView from "@/components/splitView/SplitChatView";
import ThreadInfoModal from "@/components/dashboard/ThreadInfoModal";
import DashboardDebugOverlay from "@/components/dashboard/DashboardDebugOverlay";

export default function DashboardPage() {
  const { user, loadingUser, error: userError, signOut } = useAuthSession();
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // User tier for freemium limits
  const { tier, loading: tierLoading, refreshTier, isExpired, canUseServices } = useUserTier(user?.id);

  // BYOK status - check if user has configured any API keys
  const { hasAnyKey, loading: byokLoading } = useBYOKStatus();

  // Check if user is admin (for debug overlay)
  const isAdmin = user?.email === 'dave@deepthinklabs.ai';

  // Verify subscription on upgrade success redirect
  const [verifyingSubscription, setVerifyingSubscription] = useState(false);

  // Check if we came from successful Stripe checkout (check on mount)
  const [isFromSuccessfulCheckout, setIsFromSuccessfulCheckout] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('upgrade') === 'success';
    }
    return false;
  });

  // Thread info modal state - stores the thread ID to show info for
  const [threadInfoId, setThreadInfoId] = useState<string | null>(null);

  // Chatbot settings panel editing state - tracks which chatbot ID is being edited
  const [editingChatbotId, setEditingChatbotId] = useState<string | null>(null);
  const isEditingChatbot = editingChatbotId !== null;

  // Draft config for real-time preview while editing chatbot settings
  const [previewConfig, setPreviewConfig] = useState<import("@/types/chatbotFile").ChatbotFileConfig | null>(null);

  useEffect(() => {
    const verifyUpgrade = async () => {
      if (!user?.id) return;

      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('upgrade') !== 'success') return;

      setVerifyingSubscription(true);

      try {
        // Use centralized subscription verification service
        const result = await verifySubscriptionWithRetry(
          user.id,
          RETRY_STRATEGIES.CONSERVATIVE, // 3 retries, 2s delay for dashboard
          (attempt, max) => console.log(`[Dashboard] Verification attempt ${attempt}/${max}`)
        );

        console.log('[Dashboard] Subscription verification:', result);

        // Refresh the tier from database regardless of result
        await refreshTier();
        // Clean up URL
        window.history.replaceState({}, '', '/dashboard');
      } catch (error) {
        console.error('[Dashboard] Error verifying subscription:', error);
        await refreshTier(); // Still refresh on error
      } finally {
        setVerifyingSubscription(false);
        setIsFromSuccessfulCheckout(false);
      }
    };

    verifyUpgrade();
  }, [user?.id, refreshTier]);

  // Onboarding status
  const { needsOnboarding, loading: onboardingLoading, markOnboardingComplete } = useOnboardingStatus(user?.id);

  // Force refresh tier when page becomes visible (handles browser back/forward cache)
  // This ensures we catch users clicking back from Stripe checkout
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user?.id) {
        refreshTier();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user?.id, refreshTier]);

  // Model selection state
  const [selectedModel, setSelectedModelState] = useState<AIModel>(() => getSelectedModel());

  const handleModelChange = useCallback((model: AIModel) => {
    setSelectedModelState(model);
    setSelectedModel(model); // Persist to localStorage
    // Automatically disable web search for models that don't support it
    if (!modelSupportsWebSearch(model)) {
      setEnableWebSearch(false);
    }
  }, []);


  // Web search toggle
  const [enableWebSearch, setEnableWebSearch] = useState(true);
  const webSearchSupported = modelSupportsWebSearch(selectedModel);
  const toggleWebSearch = useCallback(() => {
    // Only allow toggling if the model supports web search
    if (webSearchSupported) {
      setEnableWebSearch(prev => !prev);
    }
  }, [webSearchSupported]);

  // Auto-clear API key on logout for security
  useApiKeyCleanup();

  // Load user-level feature toggles (fallback when no chatbot config)
  const { isFeatureEnabled: userIsFeatureEnabled } = useFeatureToggles(user?.id);

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

  // Chatbot management - basic hooks that don't depend on selectedThreadId
  const {
    chatbots,
    loadingChatbots,
    selectedChatbotId,
    selectChatbot,
    createChatbot,
    updateChatbot,
    deleteChatbot,
    duplicateChatbot,
    getChatbotById,
    refreshChatbots,
  } = useChatbots(user?.id);

  // Chatbot folders
  const {
    folders: chatbotFolders,
    folderTree: chatbotFolderTree,
    defaultFolderId: chatbotDefaultFolderId,
    createFolder: createChatbotFolder,
    updateFolder: updateChatbotFolder,
    deleteFolder: deleteChatbotFolder,
    moveFolder: moveChatbotFolder,
    moveChatbot,
    toggleFolderCollapse: toggleChatbotFolderCollapse,
  } = useChatbotFolders(user?.id, chatbots, {
    onChatbotMoved: refreshChatbots,
  });

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

  // Active chatbot for current thread - must be after useThreads since it uses selectedThreadId
  const {
    activeChatbot,
    setThreadChatbot,
    loadingActiveChatbot,
  } = useActiveChatbot(user?.id, selectedThreadId, chatbots);

  // Step-by-step mode - initialized from chatbot config
  const {
    isStepByStepWithExplanation,
    isStepByStepNoExplanation,
    toggleStepByStepWithExplanation,
    toggleStepByStepNoExplanation,
    getSystemPromptAddition,
  } = useStepByStepMode(activeChatbot?.config);


  // Handle creating a new chatbot
  const handleCreateChatbot = useCallback(async (input: CreateChatbotInput) => {
    const chatbot = await createChatbot(input);
    if (!chatbot) {
      // Throw error so the modal can display it
      throw new Error("Failed to create chatbot. Please check if the database is set up correctly.");
    }
    console.log('[Dashboard] Created chatbot:', chatbot.name);
  }, [createChatbot]);

  // Handle editing a chatbot - opens the settings panel
  const handleEditChatbot = useCallback((id: string) => {
    console.log('[Dashboard] Edit chatbot:', id);
    setEditingChatbotId(id);
  }, []);

  // Handle duplicating a chatbot
  const handleDuplicateChatbot = useCallback(async (id: string) => {
    await duplicateChatbot(id);
  }, [duplicateChatbot]);

  // Handle deleting a chatbot
  const handleDeleteChatbot = useCallback(async (id: string) => {
    await deleteChatbot(id);
  }, [deleteChatbot]);

  // Handle renaming a chatbot
  const handleRenameChatbot = useCallback(async (id: string, newName: string) => {
    await updateChatbot(id, { name: newName });
  }, [updateChatbot]);

  // Handle updating chatbot config (from settings panel)
  const handleUpdateChatbotConfig = useCallback(async (id: string, config: import("@/types/chatbotFile").ChatbotFileConfig) => {
    console.log('[Dashboard] Updating chatbot config:', id);
    console.log('[Dashboard] New config:', config);
    try {
      await updateChatbot(id, { config });
      console.log('[Dashboard] Chatbot config updated successfully');
    } catch (error) {
      console.error('[Dashboard] Failed to update chatbot config:', error);
      throw error;
    }
  }, [updateChatbot]);

  // Handle opening chatbot settings panel (from sidebar or header)
  const handleOpenChatbotSettings = useCallback((chatbotId: string) => {
    console.log('[Dashboard] Opening chatbot settings panel:', chatbotId);
    setEditingChatbotId(chatbotId);
  }, []);

  // Handle closing chatbot settings panel
  const handleCloseChatbotSettings = useCallback(() => {
    console.log('[Dashboard] Closing chatbot settings panel');
    setEditingChatbotId(null);
    setPreviewConfig(null);
  }, []);

  // Handle draft config changes for real-time preview
  const handleDraftConfigChange = useCallback((config: import("@/types/chatbotFile").ChatbotFileConfig | null) => {
    console.log('[Dashboard] Draft config changed for preview:', config?.model?.model_name);
    setPreviewConfig(config);
  }, []);

  // Handle opening settings for the active chatbot (from header)
  const handleEditActiveChatbot = useCallback(() => {
    if (activeChatbot) {
      console.log('[Dashboard] Opening settings for active chatbot:', activeChatbot.name);
      setEditingChatbotId(activeChatbot.id);
    }
  }, [activeChatbot]);

  // Handle opening settings for the default chatbot (no chatbot assigned)
  const handleEditDefaultChatbot = useCallback(() => {
    console.log('[Dashboard] Opening settings for default chatbot');
    setEditingChatbotId('__default__');
  }, []);


  // Handle chatbot selection for thread (from MessageComposer)
  const handleChatbotChange = useCallback(async (chatbot: { id: string } | null) => {
    if (selectedThreadId) {
      await setThreadChatbot(selectedThreadId, chatbot?.id || null);
    }
  }, [selectedThreadId, setThreadChatbot]);

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

  // Create a preview-aware chatbot for real-time editing preview
  // When editing, use the preview config; otherwise use the saved chatbot
  const previewChatbot = React.useMemo(() => {
    if (!activeChatbot) return null;
    if (!previewConfig || !isEditingChatbot) return activeChatbot;
    // Overlay preview config on the active chatbot for display
    return {
      ...activeChatbot,
      config: previewConfig,
    };
  }, [activeChatbot, previewConfig, isEditingChatbot]);

  // Merged isFeatureEnabled that uses chatbot config first, then falls back to user preferences
  // This allows chatbot-specific feature overrides while maintaining user defaults
  const isFeatureEnabled = useCallback(
    (featureId: import("@/types/features").FeatureId): boolean => {
      // First check the preview/active chatbot's config
      const chatbotConfig = previewChatbot?.config;
      if (chatbotConfig?.features && featureId in chatbotConfig.features) {
        const enabled = chatbotConfig.features[featureId];
        // Only use chatbot config if explicitly set (not undefined)
        if (enabled !== undefined) {
          console.log(`[Dashboard] Feature '${featureId}' from chatbot config:`, enabled);
          return enabled;
        }
      }
      // Fall back to user-level preferences
      const userEnabled = userIsFeatureEnabled(featureId);
      console.log(`[Dashboard] Feature '${featureId}' from user prefs:`, userEnabled);
      return userEnabled;
    },
    [previewChatbot, userIsFeatureEnabled]
  );

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
    // Debug logging - helps trace message routing
    console.log('[Dashboard handleSend] Message routing check:', {
      hasSelectedWorkflow: !!selectedWorkflow,
      workflowName: selectedWorkflow?.displayName || 'none',
      hasUserId: !!user?.id,
      draftLength: draft?.length || 0,
      attachmentsCount: attachedFiles?.length || 0,
    });

    if (selectedWorkflow && user?.id) {
      // Route through workflow
      console.log('[Dashboard handleSend] Routing message through workflow:', selectedWorkflow.displayName);
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
      console.log('[Dashboard handleSend] Using regular chat flow (no workflow selected)');
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

  if (loadingUser || onboardingLoading || tierLoading || isFromSuccessfulCheckout) {
    return (
      <div className="flex h-full items-center justify-center text-foreground">
        <div className="text-center">
          {isFromSuccessfulCheckout ? (
            <>
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-lavender border-r-transparent mb-4"></div>
              <p className="text-lg font-medium text-foreground">Activating your subscription...</p>
              <p className="text-sm text-foreground/60 mt-2">Please wait while we confirm your payment.</p>
            </>
          ) : (
            'Loading…'
          )}
        </div>
      </div>
    );
  }

  if (userError) {
    return (
      <div className="flex h-full items-center justify-center text-red-500">
        Error: {userError}
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Show onboarding for new users OR users with 'pending' tier (haven't completed Stripe checkout)
  // Both conditions block access: needsOnboarding (onboarding_completed: false) AND tier === 'pending'
  // This prevents users from bypassing payment by clicking back from Stripe checkout
  if (needsOnboarding || tier === 'pending') {
    return <OnboardingFlow userId={user.id} userEmail={user.email} onComplete={markOnboardingComplete} onLogout={signOut} />;
  }

  return (
    <div className="flex flex-row h-full text-foreground">
      {/* LEFT: sidebar column */}
      <aside
        className="h-full flex-shrink-0 relative"
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
          // Thread info prop
          onShowThreadInfo={setThreadInfoId}
          // Chatbot props
          chatbots={chatbots}
          chatbotFolderTree={chatbotFolderTree}
          selectedChatbotId={selectedChatbotId}
          onSelectChatbot={selectChatbot}
          onCreateChatbot={handleCreateChatbot}
          onEditChatbot={handleEditChatbot}
          onDuplicateChatbot={handleDuplicateChatbot}
          onDeleteChatbot={handleDeleteChatbot}
          onRenameChatbot={handleRenameChatbot}
          onUpdateChatbotConfig={handleUpdateChatbotConfig}
          chatbotDefaultFolderId={chatbotDefaultFolderId}
          currentChatbotConfig={activeChatbot?.config}
          editingChatbotId={editingChatbotId}
          onCloseChatbotSettings={handleCloseChatbotSettings}
          onDraftConfigChange={handleDraftConfigChange}
          // Chatbot folder props
          onCreateChatbotFolder={createChatbotFolder}
          onUpdateChatbotFolder={updateChatbotFolder}
          onDeleteChatbotFolder={deleteChatbotFolder}
          onMoveChatbotFolder={moveChatbotFolder}
          onMoveChatbot={moveChatbot}
          onToggleChatbotFolderCollapse={toggleChatbotFolderCollapse}
        />
        {/* Resize handle */}
        <div
          onMouseDown={handleSidebarResize}
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-sky/50 transition-colors ${
            isResizing ? "bg-sky/50" : "bg-transparent"
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
                {/* Header at top of chat column with Split View button */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <ChatHeader
                      currentThreadTitle={currentThread?.title ?? null}
                      hasThread={!!selectedThreadId}
                      onShowInfo={() => selectedThreadId && setThreadInfoId(selectedThreadId)}
                      activeChatbot={previewChatbot}
                      onEditChatbot={handleEditActiveChatbot}
                      onEditDefaultChatbot={handleEditDefaultChatbot}
                      isEditingChatbot={isEditingChatbot}
                    />
                  </div>
                  {selectedThreadId && (
                    <button
                      onClick={() => activateSplitView(selectedThreadId, null)}
                      className="flex-shrink-0 rounded-full border border-white/40 bg-white/60 px-3 py-2 text-sm font-medium text-foreground hover:bg-white/80 transition-colors flex items-center gap-2 backdrop-blur-md"
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

            {/* Verifying Subscription Banner */}
            {verifyingSubscription && (
              <div className="rounded-lg border border-purple-500/30 bg-purple-500/10 p-4">
                <div className="flex items-center gap-3">
                  <svg className="h-5 w-5 text-purple-400 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <div>
                    <div className="text-sm font-semibold text-purple-300">Activating your subscription...</div>
                    <div className="text-xs text-purple-400/80 mt-1">Please wait while we confirm your payment.</div>
                  </div>
                </div>
              </div>
            )}

            {/* BYOK API Key Required Banner - show if no keys configured */}
            {!byokLoading && !hasAnyKey && !isExpired && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-amber-300">API Key Required</div>
                    <div className="text-xs text-amber-400/80 mt-1">
                      Configure at least one API key (OpenAI, Claude, Grok, or Gemini) in Settings to start chatting with AI models.
                    </div>
                    <a
                      href="/settings"
                      className="inline-flex items-center gap-2 mt-3 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 transition-colors"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Configure API Keys
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Expired Trial Banner - only show if not currently verifying */}
            {isExpired && !verifyingSubscription && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4">
                <div className="flex items-start gap-3">
                  <svg className="h-5 w-5 text-red-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-red-300">Your trial has expired</div>
                    <div className="text-xs text-red-400/80 mt-1">
                      You can view your existing threads but cannot send new messages. Subscribe to Pro to continue using all AI features.
                    </div>
                    <a
                      href="/settings"
                      className="inline-flex items-center gap-2 mt-3 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition-colors"
                    >
                      Subscribe Now - $5/month
                    </a>
                  </div>
                </div>
              </div>
            )}

            {(loadingThreads || threadsError || messagesError) && (
              <div className="rounded-2xl border border-white/40 bg-white/60 backdrop-blur-md px-4 py-2 text-xs text-foreground/70">
                {loadingThreads && <span>Loading threads… </span>}
                {threadsError && (
                  <span className="text-red-500">{threadsError} </span>
                )}
                {messagesError && (
                  <span className="text-red-500">{messagesError}</span>
                )}
              </div>
            )}

            {/* Chat card: messages + composer, very clearly separate from sidebar */}
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/40 bg-white/40 backdrop-blur-md shadow-lg">
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
              <div className="border-t border-white/30">
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
              <div className="border-t border-white/30 px-4 py-3">
                <MessageComposer
                  value={draft}
                  onChange={setDraft}
                  onSend={handleSend}
                  disabled={sendInFlight || workflowExecuting || !canUseServices || (!byokLoading && !hasAnyKey) || isEditingChatbot}
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
                  webSearchDisabled={!webSearchSupported}
                  userTier={tier}
                  isFeatureEnabled={isFeatureEnabled}
                  workflows={workflows}
                  selectedWorkflow={selectedWorkflow}
                  onWorkflowChange={selectWorkflow}
                  workflowsLoading={workflowsLoading}
                  workflowExecuting={workflowExecuting}
                  // Chatbot props
                  chatbots={chatbots}
                  selectedChatbot={activeChatbot}
                  onChatbotChange={handleChatbotChange}
                  chatbotsLoading={loadingChatbots || loadingActiveChatbot}
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

      {/* Thread Info Modal */}
      <ThreadInfoModal
        isOpen={!!threadInfoId}
        onClose={() => setThreadInfoId(null)}
        thread={threadInfoId ? (threads.find(t => t.id === threadInfoId) ?? null) : null}
        messages={threadInfoId === selectedThreadId ? messages : []}
        userEmail={user?.email || undefined}
      />

      {/* Admin Debug Overlay - Toggle with Ctrl+Shift+D */}
      <DashboardDebugOverlay
        isAdmin={isAdmin}
        userId={user?.id}
        currentThread={currentThread}
        messages={messages}
        chatbots={chatbots}
        activeChatbot={activeChatbot}
        selectedChatbotId={selectedChatbotId}
        folderTree={folderTree}
      />
    </div>
  );
}
