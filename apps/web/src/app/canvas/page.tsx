'use client';

/**
 * Canvas Page
 *
 * n8n-style visual workflow builder for orchestrating AI Agents (Chatbots),
 * Training Sessions, Boardrooms, and all app features.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { redirect } from 'next/navigation';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useCanvas } from './hooks/useCanvas';
import { useEncryptedCanvasNodes } from './hooks/useEncryptedCanvasNodes';
import { useEncryptedCanvasEdges } from './hooks/useEncryptedCanvasEdges';
import { useCanvasState } from './hooks/useCanvasState';
import { useWorkflowExecutions } from './hooks/useWorkflowExecutions';
import { useEncryption } from '@/contexts/EncryptionContext';
import { CanvasStateProvider, type CanvasStateContextValue } from './context/CanvasStateContext';
import CanvasShell from './components/CanvasShell';
import CreateCanvasModal from './components/modals/CreateCanvasModal';
import CanvasNotifications from './components/CanvasNotifications';

export default function CanvasPage() {
  const { user, loadingUser } = useAuthSession();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { state: encryptionState } = useEncryption();

  // Redirect if not authenticated
  useEffect(() => {
    if (!loadingUser && !user) {
      redirect('/auth');
    }
  }, [loadingUser, user]);

  // Canvas management
  const {
    canvases,
    currentCanvas,
    loading: canvasLoading,
    error: canvasError,
    createCanvas,
    updateCanvas,
    deleteCanvas,
    selectCanvas,
  } = useCanvas(user?.id);

  // Nodes and edges for current canvas (with encryption)
  const {
    nodes,
    loading: nodesLoading,
    encryptionError: nodesEncryptionError,
    addNode,
    updateNode,
    deleteNode,
    duplicateNode,
  } = useEncryptedCanvasNodes(currentCanvas?.id || null);

  const {
    edges,
    loading: edgesLoading,
    encryptionError: edgesEncryptionError,
    addEdge,
    updateEdge,
    deleteEdge,
    refreshEdges,
  } = useEncryptedCanvasEdges(currentCanvas?.id || null);

  // Workflow executions for the Executions tab
  const {
    executions,
    selectedExecution,
    selectExecution,
    refreshExecutions,
    loading: executionsLoading,
    error: executionsError,
    total: executionsTotal,
  } = useWorkflowExecutions(currentCanvas?.id || null);

  // Combine encryption errors
  const encryptionError = nodesEncryptionError || edgesEncryptionError;

  // Phase 2: Unified state management
  const canvasState = useCanvasState();

  // Wrapper for deleteNode that also refreshes edges (cascade delete coordination)
  const handleDeleteNode = async (nodeId: string): Promise<boolean> => {
    canvasState.setLoading('node', 'deleting', nodeId);
    try {
      const success = await deleteNode(nodeId);
      if (success) {
        // Refresh edges to remove any that were cascade deleted
        await refreshEdges();
        canvasState.clearLoading();
        return true;
      } else {
        canvasState.setError('node', 'deleting', 'Failed to delete node', nodeId, true);
        return false;
      }
    } catch (err) {
      canvasState.setError('node', 'deleting', err instanceof Error ? err.message : 'Unknown error', nodeId, true);
      return false;
    }
  };

  // Phase 3: Create context value (eliminates props drilling)
  const contextValue: CanvasStateContextValue = useMemo(
    () => ({
      canvas: {
        current: currentCanvas,
        list: canvases,
        select: selectCanvas,
        create: () => setShowCreateModal(true),
        update: updateCanvas,
        delete: deleteCanvas,
      },
      nodes: {
        list: nodes,
        add: addNode,
        update: updateNode,
        delete: handleDeleteNode,
        duplicate: duplicateNode,
      },
      edges: {
        list: edges,
        add: addEdge,
        update: updateEdge,
        delete: deleteEdge,
      },
      executions: {
        list: executions,
        selected: selectedExecution,
        select: selectExecution,
        refresh: refreshExecutions,
        loading: executionsLoading,
        error: executionsError,
        total: executionsTotal,
      },
      state: {
        loading: canvasState.loading,
        error: canvasState.error,
        isLoading: canvasState.isLoading,
        clearError: canvasState.clearError,
      },
      // Legacy loading for backward compatibility
      loading: canvasLoading || nodesLoading || edgesLoading,
    }),
    [
      currentCanvas,
      canvases,
      selectCanvas,
      updateCanvas,
      deleteCanvas,
      nodes,
      addNode,
      updateNode,
      handleDeleteNode,
      duplicateNode,
      edges,
      addEdge,
      updateEdge,
      deleteEdge,
      executions,
      selectedExecution,
      selectExecution,
      refreshExecutions,
      executionsLoading,
      executionsError,
      executionsTotal,
      canvasState.loading,
      canvasState.error,
      canvasState.isLoading,
      canvasState.clearError,
      canvasLoading,
      nodesLoading,
      edgesLoading,
    ]
  );

  // Show loading state while auth is loading
  if (loadingUser) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-lavender border-t-transparent mx-auto" />
          <p className="text-foreground/60">Loading Canvas...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (canvasError) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="max-w-md rounded-xl border border-red-500/30 bg-red-500/10 backdrop-blur-md p-6 text-center">
          <h2 className="mb-2 text-lg font-bold text-red-700">Error Loading Canvas</h2>
          <p className="text-sm text-foreground/70">{canvasError}</p>
        </div>
      </div>
    );
  }

  // Show encryption locked state
  if (encryptionState.hasEncryption && !encryptionState.isUnlocked && !encryptionState.isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="max-w-md rounded-xl border border-amber-500/30 bg-amber-500/10 backdrop-blur-md p-6 text-center">
          <div className="mb-4 text-4xl">🔒</div>
          <h2 className="mb-2 text-lg font-bold text-amber-700">Canvas Locked</h2>
          <p className="text-sm text-foreground/70">
            Your canvas data is encrypted. Please unlock your encryption to view and edit your canvases.
          </p>
        </div>
      </div>
    );
  }

  // Show encryption error state
  if (encryptionError) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="max-w-md rounded-xl border border-red-500/30 bg-red-500/10 backdrop-blur-md p-6 text-center">
          <h2 className="mb-2 text-lg font-bold text-red-700">Encryption Error</h2>
          <p className="text-sm text-foreground/70">{encryptionError}</p>
        </div>
      </div>
    );
  }

  // Show empty state if no canvases
  if (!canvasLoading && canvases.length === 0 && !currentCanvas) {
    return (
      <>
        <div className="flex h-screen flex-col items-center justify-center p-8">
          <div className="max-w-2xl text-center">
            {/* Icon */}
            <div className="mb-6 text-6xl">🎨</div>

            {/* Title */}
            <h1 className="mb-4 text-3xl font-bold text-foreground">
              Welcome to Canvas
            </h1>

            {/* Description */}
            <p className="mb-8 text-lg text-foreground/70">
              Canvas is your visual workflow builder for orchestrating AI Agents,
              Training Sessions, Boardrooms, and all your AI features in one place.
            </p>

            {/* Features List */}
            <div className="mb-8 grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
              <div className="rounded-xl border border-white/40 bg-white/60 backdrop-blur-md p-4">
                <div className="mb-2 text-2xl">🤖</div>
                <h3 className="mb-1 font-semibold text-foreground">AI Agents</h3>
                <p className="text-sm text-foreground/60">
                  Connect and orchestrate multiple AI agents with different roles
                </p>
              </div>

              <div className="rounded-xl border border-white/40 bg-white/60 backdrop-blur-md p-4">
                <div className="mb-2 text-2xl">🎓</div>
                <h3 className="mb-1 font-semibold text-foreground">Training Sessions</h3>
                <p className="text-sm text-foreground/60">
                  Refine bot behavior through interactive training workflows
                </p>
              </div>

              <div className="rounded-xl border border-white/40 bg-white/60 backdrop-blur-md p-4">
                <div className="mb-2 text-2xl">🏛️</div>
                <h3 className="mb-1 font-semibold text-foreground">Boardrooms</h3>
                <p className="text-sm text-foreground/60">
                  Multi-bot discussions for brainstorming and decision-making
                </p>
              </div>

              <div className="rounded-xl border border-white/40 bg-white/60 backdrop-blur-md p-4">
                <div className="mb-2 text-2xl">⚡</div>
                <h3 className="mb-1 font-semibold text-foreground">Automation</h3>
                <p className="text-sm text-foreground/60">
                  Triggers, tools, and workflows for full automation
                </p>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-lg bg-sky px-8 py-3 text-lg font-medium text-white hover:bg-sky/80 transition-colors"
            >
              Create Your First Canvas
            </button>
          </div>

          {/* Create Canvas Modal */}
          {showCreateModal && (
            <CreateCanvasModal
              isOpen={showCreateModal}
              onClose={() => setShowCreateModal(false)}
              onCreate={async (input) => {
                const newCanvas = await createCanvas(input);
                if (newCanvas) {
                  setShowCreateModal(false);
                }
              }}
            />
          )}
        </div>

        {/* Phase 2: Centralized Notifications */}
        <CanvasNotifications
          loading={canvasState.loading}
          error={canvasState.error}
          onClearError={canvasState.clearError}
          onRetry={() => {
            // Retry logic can be added based on the operation
            canvasState.clearError();
          }}
        />
      </>
    );
  }

  // Main Canvas UI
  return (
    <>
      <CanvasStateProvider value={contextValue}>
        <CanvasShell />
      </CanvasStateProvider>

      {/* Create Canvas Modal */}
      {showCreateModal && (
        <CreateCanvasModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCreate={async (input) => {
            const newCanvas = await createCanvas(input);
            if (newCanvas) {
              setShowCreateModal(false);
            }
          }}
        />
      )}

      {/* Phase 2: Centralized Notifications */}
      <CanvasNotifications
        loading={canvasState.loading}
        error={canvasState.error}
        onClearError={canvasState.clearError}
        onRetry={() => {
          // Retry logic can be added based on the operation
          canvasState.clearError();
        }}
      />
    </>
  );
}
