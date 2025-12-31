'use client';

/**
 * Canvas Shell
 *
 * Phase 3: Refactored to use Context API instead of props drilling.
 * All Canvas state and operations are now accessed via useCanvasContext().
 *
 * Main container for the Canvas feature with:
 * - Left sidebar: Canvas list + Node palette
 * - Center: React Flow canvas
 * - Right sidebar: Node inspector
 * - Top toolbar: Controls + mode toggles
 */

import React, { useState } from 'react';
import NodePalette from './NodePalette';
import CanvasViewport from './CanvasViewport';
import NodeInspector from './NodeInspector';
import WorkflowControls from './WorkflowControls';
import CanvasHelpTooltip from './CanvasHelpTooltip';
import ExecutionsView from './ExecutionsView';
import { CanvasProvider } from '../context/CanvasContext';
import { useCanvasContext } from '../context/CanvasStateContext';
import { useCanvasOperations } from '../hooks/useCanvasOperations';
import { useAuthSession } from '@/hooks/useAuthSession';

type CanvasTab = 'canvas' | 'executions';

export default function CanvasShell() {
  // Phase 3: Get all Canvas state and operations from context
  const { canvas, nodes: nodeOps, edges: edgeOps, state } = useCanvasContext();
  const { user } = useAuthSession();

  // UI state
  const [showNodePalette, setShowNodePalette] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [workflowMode, setWorkflowMode] = useState(false);
  const [activeTab, setActiveTab] = useState<CanvasTab>('canvas');

  // Phase 3, Fix #2: Centralized event handlers
  const {
    selectedNodeId,
    showDuplicateToast,
    handleNodeClick,
    handleCanvasClick,
    handleAddNodeFromPalette,
    handleNodesChange,
    handleEdgesChange,
    handleConnect,
    handleUpdateSelectedNode,
    handleDeleteSelectedNode,
    handleDuplicateSelectedNode,
  } = useCanvasOperations({ showInspector, setShowInspector });

  // Check if user is admin
  const isAdmin = user?.email === 'dave@deepthinklabs.ai';

  // Get selected node
  const selectedNode = selectedNodeId
    ? nodeOps.list.find(n => n.id === selectedNodeId) || null
    : null;

  return (
    <div className="flex h-screen flex-col">
      {/* Top Toolbar */}
      <div className="border-b border-white/40 bg-white/40 backdrop-blur-md px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Main Controls */}
          <div className="flex-1">
            <WorkflowControls
              currentCanvas={canvas.current}
              canvases={canvas.list}
              onSelectCanvas={canvas.select}
              onCreateCanvas={canvas.create}
              onUpdateCanvas={canvas.update}
              onDeleteCanvas={canvas.delete}
              workflowMode={workflowMode}
              onToggleWorkflowMode={() => setWorkflowMode(!workflowMode)}
              onToggleNodePalette={() => setShowNodePalette(!showNodePalette)}
              onToggleInspector={() => setShowInspector(!showInspector)}
              showNodePalette={showNodePalette}
              showInspector={showInspector}
            />
          </div>

          {/* Tab Buttons */}
          <div className="flex items-center rounded-lg border border-white/40 bg-white/60 p-0.5">
            <button
              onClick={() => setActiveTab('canvas')}
              className={`
                px-4 py-1.5 text-sm font-medium rounded-md transition-colors
                ${activeTab === 'canvas'
                  ? 'bg-sky text-white'
                  : 'text-foreground/60 hover:text-foreground'
                }
              `}
            >
              Canvas
            </button>
            <button
              onClick={() => setActiveTab('executions')}
              className={`
                px-4 py-1.5 text-sm font-medium rounded-md transition-colors
                ${activeTab === 'executions'
                  ? 'bg-sky text-white'
                  : 'text-foreground/60 hover:text-foreground'
                }
              `}
            >
              Executions
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {activeTab === 'canvas' ? (
          <>
            {/* Left Sidebar - Node Palette */}
            {showNodePalette && (
              <div className="w-64 flex-shrink-0 border-r border-white/40 bg-white/40 backdrop-blur-md">
                <NodePalette onAddNode={handleAddNodeFromPalette} />
              </div>
            )}

            {/* Center - Canvas Viewport */}
            <div className="flex-1 relative">
              {canvas.current ? (
                <CanvasProvider
                  value={{
                    nodes: nodeOps.list,
                    edges: edgeOps.list,
                    onAddNode: nodeOps.add,
                    onUpdateNode: nodeOps.update,
                    onDeleteNode: nodeOps.delete,
                    onDuplicateNode: nodeOps.duplicate,
                    onAddEdge: edgeOps.add,
                    onUpdateEdge: edgeOps.update,
                    onDeleteEdge: edgeOps.delete,
                  }}
                >
                  <CanvasViewport
                    nodes={nodeOps.list}
                    edges={edgeOps.list}
                    selectedNodeId={selectedNodeId}
                    onNodeClick={handleNodeClick}
                    onCanvasClick={handleCanvasClick}
                    onNodesChange={handleNodesChange}
                    onEdgesChange={handleEdgesChange}
                    onConnect={handleConnect}
                    workflowMode={workflowMode}
                    isAdmin={isAdmin}
                  />

                  {/* Help Tooltip */}
                  <CanvasHelpTooltip />
                </CanvasProvider>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <p className="text-foreground/60">No canvas selected</p>
                </div>
              )}

              {/* Loading Overlay */}
              {state.isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                  <div className="rounded-xl border border-white/40 bg-white/80 px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-lavender border-t-transparent" />
                      <span className="text-foreground">Loading canvas...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Sidebar - Node Inspector */}
            {showInspector && (
              <div className="w-80 flex-shrink-0 border-l border-white/40 bg-white/40 backdrop-blur-md">
                <NodeInspector
                  node={selectedNode}
                  onUpdateNode={handleUpdateSelectedNode}
                  onDeleteNode={handleDeleteSelectedNode}
                  onDuplicateNode={handleDuplicateSelectedNode}
                  onClose={handleCanvasClick}
                />
              </div>
            )}
          </>
        ) : (
          /* Executions Tab - Full Page View */
          <ExecutionsView />
        )}
      </div>

      {/* Duplicate Edge Toast Notification */}
      {showDuplicateToast && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[10000] animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 shadow-lg backdrop-blur-md">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
              <span className="text-lg">⚠️</span>
            </div>
            <div>
              <p className="text-sm font-medium text-amber-700">Connection Already Exists</p>
              <p className="text-xs text-amber-600">These nodes are already connected</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
