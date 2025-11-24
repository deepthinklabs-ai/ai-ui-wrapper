'use client';

/**
 * Canvas Page
 *
 * n8n-style visual workflow builder for orchestrating Genesis Bots,
 * Training Sessions, Boardrooms, and all app features.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { redirect } from 'next/navigation';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useCanvas } from './hooks/useCanvas';
import { useCanvasNodes } from './hooks/useCanvasNodes';
import { useCanvasEdges } from './hooks/useCanvasEdges';
import { useCanvasState } from './hooks/useCanvasState';
import { CanvasStateProvider, type CanvasStateContextValue } from './context/CanvasStateContext';
import CanvasShell from './components/CanvasShell';
import CreateCanvasModal from './components/modals/CreateCanvasModal';
import CanvasNotifications from './components/CanvasNotifications';

export default function CanvasPage() {
  const { user, loadingUser } = useAuthSession();
  const [showCreateModal, setShowCreateModal] = useState(false);

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

  // Nodes and edges for current canvas
  const {
    nodes,
    loading: nodesLoading,
    addNode,
    updateNode,
    deleteNode,
    duplicateNode,
  } = useCanvasNodes(currentCanvas?.id || null);

  const {
    edges,
    loading: edgesLoading,
    addEdge,
    updateEdge,
    deleteEdge,
    refreshEdges,
  } = useCanvasEdges(currentCanvas?.id || null);

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
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto" />
          <p className="text-slate-400">Loading Canvas...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (canvasError) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="max-w-md rounded-lg border border-red-500/50 bg-red-500/10 p-6 text-center">
          <h2 className="mb-2 text-lg font-bold text-red-400">Error Loading Canvas</h2>
          <p className="text-sm text-slate-300">{canvasError}</p>
        </div>
      </div>
    );
  }

  // Show empty state if no canvases
  if (!canvasLoading && canvases.length === 0 && !currentCanvas) {
    return (
      <>
        <div className="flex h-screen flex-col items-center justify-center bg-slate-950 p-8">
          <div className="max-w-2xl text-center">
            {/* Icon */}
            <div className="mb-6 text-6xl">🎨</div>

            {/* Title */}
            <h1 className="mb-4 text-3xl font-bold text-slate-100">
              Welcome to Canvas
            </h1>

            {/* Description */}
            <p className="mb-8 text-lg text-slate-300">
              Canvas is your visual workflow builder for orchestrating Genesis Bots,
              Training Sessions, Boardrooms, and all your AI features in one place.
            </p>

            {/* Features List */}
            <div className="mb-8 grid grid-cols-1 gap-4 text-left sm:grid-cols-2">
              <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <div className="mb-2 text-2xl">🤖</div>
                <h3 className="mb-1 font-semibold text-slate-200">Genesis Bots</h3>
                <p className="text-sm text-slate-400">
                  Connect and orchestrate multiple AI bots with different roles
                </p>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <div className="mb-2 text-2xl">🎓</div>
                <h3 className="mb-1 font-semibold text-slate-200">Training Sessions</h3>
                <p className="text-sm text-slate-400">
                  Refine bot behavior through interactive training workflows
                </p>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <div className="mb-2 text-2xl">🏛️</div>
                <h3 className="mb-1 font-semibold text-slate-200">Boardrooms</h3>
                <p className="text-sm text-slate-400">
                  Multi-bot discussions for brainstorming and decision-making
                </p>
              </div>

              <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
                <div className="mb-2 text-2xl">⚡</div>
                <h3 className="mb-1 font-semibold text-slate-200">Automation</h3>
                <p className="text-sm text-slate-400">
                  Triggers, tools, and workflows for full automation
                </p>
              </div>
            </div>

            {/* CTA Button */}
            <button
              onClick={() => setShowCreateModal(true)}
              className="rounded-lg bg-blue-600 px-8 py-3 text-lg font-medium text-white hover:bg-blue-500 transition-colors"
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
