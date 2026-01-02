'use client';

/**
 * Genesis Bot Chat Modal
 *
 * Full-screen modal for chatting with a Genesis Bot node.
 * Provides a complete chat interface similar to the main dashboard.
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useEncryptedMessages } from '@/hooks/useEncryptedMessages';
import { useUserTier } from '@/hooks/useUserTier';
import type { GenesisBotNodeConfig, NodeId } from '../../types';
import MessageList from '@/components/dashboard/MessageList';
import type { AIModel } from '@/lib/apiKeyStorage';
import { getSelectedModel, setSelectedModel } from '@/lib/apiKeyStorage';
import { supabase } from '@/lib/supabaseClient';
import { useCanvasContext } from '../../context/CanvasContext';
import CustomConnectionHandle from '../CustomConnectionHandle';
import {
  getEnabledGmailTools,
  toClaudeToolFormat,
  generateGmailSystemPrompt,
  executeGmailToolCalls,
} from '../../features/gmail-oauth';

interface GenesisBotChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  botConfig: GenesisBotNodeConfig;
  botLabel: string;
  nodeId: NodeId;
  initialPosition?: { x: number; y: number };
  onPositionChange?: (position: { x: number; y: number }) => void;
  inlineMode?: boolean; // If true, renders inline without portal/backdrop
}

export default function GenesisBotChatModal({
  isOpen,
  onClose,
  botConfig,
  botLabel,
  nodeId,
  initialPosition,
  onPositionChange,
  inlineMode = false,
}: GenesisBotChatModalProps) {
  const { user } = useAuthSession();
  const { tier } = useUserTier(user?.id);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [creatingThread, setCreatingThread] = useState(false);
  const [showConnections, setShowConnections] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [modalPosition, setModalPosition] = useState(initialPosition || { x: 100, y: 100 });
  const [isDraggingModal, setIsDraggingModal] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Update position when initialPosition changes
  useEffect(() => {
    if (initialPosition) {
      setModalPosition(initialPosition);
    }
  }, [initialPosition]);

  // Get canvas context for node connections
  const canvasContext = useCanvasContext();
  const { nodes, edges, onAddEdge, onDeleteEdge } = canvasContext;

  // Track if component is mounted (for portal rendering)
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Handle ESC key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle modal dragging
  const handleModalDragStart = (e: React.MouseEvent) => {
    setIsDraggingModal(true);
    dragStartPos.current = {
      x: e.clientX - modalPosition.x,
      y: e.clientY - modalPosition.y,
    };
  };

  useEffect(() => {
    if (!isDraggingModal) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newPosition = {
        x: e.clientX - dragStartPos.current.x,
        y: e.clientY - dragStartPos.current.y,
      };
      setModalPosition(newPosition);
      onPositionChange?.(newPosition);
    };

    const handleMouseUp = () => {
      setIsDraggingModal(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingModal, onPositionChange]);

  // Create a dedicated thread for this bot when modal opens
  useEffect(() => {
    const createThreadInDatabase = async () => {
      if (!isOpen || threadId || !user?.id || creatingThread) return;

      setCreatingThread(true);
      try {
        // Create a new thread in the database with a descriptive title
        const { data, error } = await supabase
          .from('threads')
          .insert({
            user_id: user.id,
            title: `Canvas: ${botLabel}`,
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating canvas bot thread:', error);
          return;
        }

        if (data) {
          setThreadId(data.id);
        }
      } catch (err) {
        console.error('Failed to create canvas bot thread:', err);
      } finally {
        setCreatingThread(false);
      }
    };

    createThreadInDatabase();
  }, [isOpen, threadId, user?.id, botLabel, creatingThread]);

  // Gmail tools configuration
  const gmailToolsConfig = useMemo(() => {
    const gmailConfig = botConfig.gmail;
    if (!gmailConfig?.enabled || !gmailConfig.connectionId) {
      return undefined;
    }

    const enabledTools = getEnabledGmailTools(gmailConfig.permissions);
    if (enabledTools.length === 0) {
      return undefined;
    }

    return {
      enabled: true,
      tools: toClaudeToolFormat(enabledTools),
      systemPrompt: generateGmailSystemPrompt(gmailConfig),
      executor: async (toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }>) => {
        if (!user?.id) {
          return toolCalls.map(tc => ({
            toolCallId: tc.id,
            result: JSON.stringify({ error: 'User not authenticated' }),
            isError: true,
          }));
        }
        return executeGmailToolCalls(toolCalls, user.id, nodeId, gmailConfig.permissions);
      },
    };
  }, [botConfig.gmail, user?.id, nodeId]);

  // Messages hook with encryption
  const {
    messages,
    loadingMessages,
    messagesError,
    encryptionError,
    sendInFlight,
    isEncryptionReady,
    sendMessage,
  } = useEncryptedMessages(threadId, {
    userId: user?.id,
    userTier: tier,
    systemPromptAddition: botConfig.system_prompt,
    enableWebSearch: botConfig.web_search_enabled !== false, // Enabled by default, can be disabled
    disableMCPTools: true, // Canvas bots are isolated and don't use MCP tools
    gmailTools: gmailToolsConfig, // Gmail integration if configured
  });

  // Calculate existing connections
  const existingConnections = useMemo(() => {
    const outgoing = edges
      .filter(e => e.from_node_id === nodeId)
      .map(e => e.to_node_id);
    const incoming = edges
      .filter(e => e.to_node_id === nodeId)
      .map(e => e.from_node_id);

    return { outgoing, incoming };
  }, [edges, nodeId]);

  // Handle node connections
  // Handle connection when dragging from output handle
  const handleOutputConnection = async (targetNodeId: NodeId | null) => {
    if (targetNodeId && targetNodeId !== nodeId) {
      await onAddEdge(nodeId, targetNodeId);
    }
  };

  // Handle connection when dragging from input handle
  const handleInputConnection = async (sourceNodeId: NodeId | null) => {
    if (sourceNodeId && sourceNodeId !== nodeId) {
      await onAddEdge(sourceNodeId, nodeId);
    }
  };

  const handleSend = async () => {
    if (!threadId || !inputValue.trim() || sendInFlight) return;

    console.log('[Genesis Bot] Sending message with disableMCPTools=true');

    const content = inputValue;
    setInputValue(''); // Clear input immediately

    // Temporarily set the bot's configured model
    const previousModel = getSelectedModel();
    setSelectedModel(botConfig.model_name as AIModel);

    try {
      await sendMessage(content, []);
    } finally {
      // Restore the previous model selection
      setSelectedModel(previousModel);
    }
  };

  if (!isOpen) return null;

  // Inline mode: Just render the content directly without portal/backdrop
  if (inlineMode) {
    return (
      <div className="flex flex-col w-full max-h-[600px] overflow-hidden">
        {/* Header with close button */}
        <div className="flex-shrink-0 border-b border-white/30 px-4 py-3 flex items-center justify-between bg-white/60 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="text-2xl">🤖</div>
            <div>
              <h2 className="text-sm font-bold text-foreground">{botLabel}</h2>
              <div className="text-xs text-foreground/60">
                {botConfig.model_provider} • {botConfig.model_name}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-foreground/60 hover:bg-foreground/10 hover:text-foreground transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages Area */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-4 py-3 min-h-0 bg-white/40"
        >
          {creatingThread || !threadId ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mb-3 h-6 w-6 mx-auto animate-spin rounded-full border-4 border-foreground/20 border-t-sky" />
                <p className="text-xs text-foreground/60">Initializing...</p>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <div className="mb-3 text-4xl">💬</div>
                <p className="text-xs text-foreground/60">Start chatting</p>
              </div>
            </div>
          ) : (
            <MessageList
              messages={messages}
              loading={false}
              thinking={false}
              messageActionsDisabled={true}
              isFeatureEnabled={() => false}
            />
          )}
        </div>

        {/* Message Composer */}
        <div className="flex-shrink-0 border-t border-white/30 p-3 bg-white/60 backdrop-blur-md">
          <div className="flex items-end gap-2">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Message..."
              disabled={sendInFlight}
              className="flex-1 resize-none rounded border border-white/40 bg-white/60 px-3 py-2 text-xs text-foreground placeholder-foreground/50 focus:border-sky focus:outline-none disabled:opacity-50"
              rows={2}
            />
            <button
              onClick={handleSend}
              disabled={sendInFlight || !inputValue.trim()}
              className="rounded bg-sky px-4 py-2 text-xs font-medium text-white hover:bg-sky/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {sendInFlight ? '...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Portal mode: Full overlay modal
  if (!mounted) return null;

  const modalContent = (
    <>
      {/* Everything has pointer-events-none except specific interactive elements */}
      {/* This allows the canvas underneath to remain fully interactive for drag-to-connect */}

      {/* Backdrop - lighter so canvas nodes are visible, no pointer events */}
      <div className="fixed inset-0 z-[45] bg-black/30 pointer-events-none" />

      {/* Modal - positioned absolutely, draggable */}
      <div
        className="fixed z-[60] pointer-events-none"
        style={{
          left: `${modalPosition.x}px`,
          top: `${modalPosition.y}px`,
          width: '700px',
          maxWidth: 'calc(100vw - 40px)',
        }}
      >
        <div className="relative">
          {/* Connection Handles - have their own pointer-events-auto */}
          <CustomConnectionHandle
            nodeId={nodeId}
            type="input"
            position="left"
            onEndConnection={handleInputConnection}
          />
          <CustomConnectionHandle
            nodeId={nodeId}
            type="output"
            position="right"
            onEndConnection={handleOutputConnection}
          />

          <div
            id={`modal-node-${nodeId}`}
            className="relative max-h-[85vh] rounded-2xl border border-white/30 bg-white/80 backdrop-blur-md shadow-2xl flex flex-col overflow-hidden pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
          {/* Header - Draggable */}
          <div
            className="flex-shrink-0 border-b border-white/30 px-6 py-4 flex items-center justify-between cursor-move bg-white/60"
            onMouseDown={handleModalDragStart}
          >
            <div className="flex items-center gap-3">
              <div className="text-3xl">🤖</div>
              <div>
                <h2 className="text-lg font-bold text-foreground">{botLabel}</h2>
                <div className="text-sm text-foreground/60">
                  {botConfig.model_provider} • {botConfig.model_name}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              onMouseDown={(e) => e.stopPropagation()}
              className="rounded-lg p-2 text-foreground/60 hover:bg-foreground/10 hover:text-foreground transition-colors"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Bot Configuration Info */}
          {botConfig.system_prompt && (
            <div className="flex-shrink-0 border-b border-white/30 bg-foreground/5 px-6 py-3">
              <details className="group">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-foreground/60 hover:text-foreground/80">
                  System Prompt
                  <span className="ml-2 group-open:hidden">▶</span>
                  <span className="ml-2 hidden group-open:inline">▼</span>
                </summary>
                <div className="mt-2 max-h-24 overflow-y-auto rounded border border-white/30 bg-white/60 p-3 text-xs text-foreground/80">
                  {botConfig.system_prompt}
                </div>
              </details>
            </div>
          )}


          {/* Messages Area */}
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto px-6 py-4 min-h-0 bg-white/40"
          >
            {creatingThread || !threadId ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mb-4 h-8 w-8 mx-auto animate-spin rounded-full border-4 border-foreground/20 border-t-sky" />
                  <p className="text-sm text-foreground/60">Initializing chat...</p>
                </div>
              </div>
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <div className="mb-4 text-5xl">💬</div>
                  <h3 className="mb-2 text-lg font-semibold text-foreground/80">
                    Start a conversation
                  </h3>
                  <p className="text-sm text-foreground/50">
                    This bot is configured with custom settings and ready to chat
                  </p>
                </div>
              </div>
            ) : (
              <MessageList
                messages={messages}
                loading={false}
                thinking={false}
                messageActionsDisabled={true}
                isFeatureEnabled={() => false}
              />
            )}
          </div>

          {/* Error Display */}
          {messagesError && (
            <div className="flex-shrink-0 border-t border-red-500/20 bg-red-500/10 px-6 py-3">
              <div className="text-sm text-red-600">{messagesError}</div>
            </div>
          )}

          {/* Message Composer - Simplified for Canvas */}
          <div className="flex-shrink-0 border-t border-white/30 p-4 bg-white/60">
            <div className="flex items-end gap-3">
              {/* Text Input */}
              <div className="flex-1">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder={`Chat with ${botLabel}... (Shift+Enter for new line)`}
                  disabled={sendInFlight}
                  className="w-full resize-none rounded-lg border border-white/40 bg-white/60 px-4 py-3 text-sm text-foreground placeholder-foreground/50 focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/50 disabled:opacity-50"
                  rows={3}
                />
              </div>

              {/* Send Button */}
              <button
                onClick={handleSend}
                disabled={sendInFlight || !inputValue.trim()}
                className="rounded-lg bg-sky px-6 py-3 text-sm font-medium text-white hover:bg-sky/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {sendInFlight ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Sending...</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    <span>Send</span>
                  </div>
                )}
              </button>
            </div>

            {/* Model Info */}
            <div className="mt-2 flex items-center justify-between text-xs text-foreground/50">
              <div className="flex items-center gap-2">
                <span>Model:</span>
                <span className="text-foreground/70 font-medium">
                  {botConfig.model_provider} • {botConfig.model_name}
                </span>
              </div>
              {botConfig.temperature !== undefined && (
                <div className="flex items-center gap-2">
                  <span>Temperature:</span>
                  <span className="text-foreground/70 font-medium">{botConfig.temperature}</span>
                </div>
              )}
            </div>
          </div>
          </div>
        </div>
      </div>
    </>
  );

  // Render modal in a portal to document.body to escape React Flow's transform container
  return createPortal(modalContent, document.body);
}
