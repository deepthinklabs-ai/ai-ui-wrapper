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

import React, { useState, useCallback } from 'react';
import type {
  NodeId,
  CanvasNodeType,
} from '../types';
import NodePalette from './NodePalette';
import CanvasViewport from './CanvasViewport';
import NodeInspector from './NodeInspector';
import WorkflowControls from './WorkflowControls';
import CanvasDebugOverlay from './CanvasDebugOverlay';
import CanvasHelpTooltip from './CanvasHelpTooltip';
import { CanvasProvider } from '../context/CanvasContext';
import { useCanvasContext } from '../context/CanvasStateContext';
import { useAuthSession } from '@/hooks/useAuthSession';

export default function CanvasShell() {
  // Phase 3: Get all Canvas state and operations from context
  const { canvas, nodes: nodeOps, edges: edgeOps, state } = useCanvasContext();
  const { user } = useAuthSession();
  const [selectedNodeId, setSelectedNodeId] = useState<NodeId | null>(null);
  const [showNodePalette, setShowNodePalette] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [workflowMode, setWorkflowMode] = useState(false);

  // Toast notification state for duplicate edge prevention
  const [showDuplicateToast, setShowDuplicateToast] = useState(false);

  // Check if user is admin
  const isAdmin = user?.email === 'dave@deepthinklabs.ai';

  // Get selected node
  const selectedNode = selectedNodeId
    ? nodeOps.list.find(n => n.id === selectedNodeId) || null
    : null;

  // Handle node selection
  const handleNodeClick = useCallback((nodeId: NodeId) => {
    setSelectedNodeId(nodeId);
    if (!showInspector) {
      setShowInspector(true);
    }
  }, [showInspector]);

  // Handle canvas click (deselect)
  const handleCanvasClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  // Handle node addition from palette
  const handleAddNodeFromPalette = useCallback(
    async (type: CanvasNodeType) => {
      // Add node at center of viewport
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      const newNode = await nodeOps.add(type, { x: centerX, y: centerY });
      if (newNode) {
        setSelectedNodeId(newNode.id);
        setShowInspector(true);
      }
    },
    [nodeOps]
  );

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      {/* Top Toolbar */}
      <div className="border-b border-slate-800 bg-slate-900 px-4 py-3">
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

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Node Palette */}
        {showNodePalette && (
          <div className="w-64 flex-shrink-0 border-r border-slate-800 bg-slate-900">
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
                onNodesChange={(changes) => {
                  // Handle node position changes
                  changes.forEach((change) => {
                    if (change.type === 'position' && change.position) {
                      nodeOps.update(change.id, { position: change.position });
                    } else if (change.type === 'remove') {
                      nodeOps.delete(change.id);
                    }
                  });
                }}
                onEdgesChange={(changes) => {
                  // Handle edge changes
                  changes.forEach((change) => {
                    if (change.type === 'remove') {
                      edgeOps.delete(change.id);
                    }
                  });
                }}
                onConnect={async (connection) => {
                  // Handle new edge connection
                  if (connection.source && connection.target) {
                    const newEdge = await edgeOps.add(connection.source, connection.target, {
                      from_port: connection.sourceHandle || undefined,
                      to_port: connection.targetHandle || undefined,
                    });

                    // Show duplicate toast if edge creation returned null
                    if (newEdge === null) {
                      setShowDuplicateToast(true);
                      setTimeout(() => setShowDuplicateToast(false), 3000);
                    }
                  }
                }}
                workflowMode={workflowMode}
              />

              {/* Admin Debug Overlay */}
              <CanvasDebugOverlay
                nodes={nodeOps.list}
                edges={edgeOps.list}
                isAdmin={isAdmin}
              />

              {/* Help Tooltip */}
              <CanvasHelpTooltip />
            </CanvasProvider>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-slate-400">No canvas selected</p>
            </div>
          )}

          {/* Loading Overlay */}
          {state.isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm">
              <div className="rounded-lg border border-slate-700 bg-slate-900 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                  <span className="text-slate-200">Loading canvas...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar - Node Inspector */}
        {showInspector && (
          <div className="w-80 flex-shrink-0 border-l border-slate-800 bg-slate-900">
            <NodeInspector
              node={selectedNode}
              onUpdateNode={(updates) => {
                if (selectedNode) {
                  nodeOps.update(selectedNode.id, updates);
                }
              }}
              onDeleteNode={() => {
                if (selectedNode) {
                  nodeOps.delete(selectedNode.id);
                  setSelectedNodeId(null);
                }
              }}
              onDuplicateNode={() => {
                if (selectedNode) {
                  nodeOps.duplicate(selectedNode.id);
                }
              }}
              onClose={() => setSelectedNodeId(null)}
            />
          </div>
        )}
      </div>

      {/* Duplicate Edge Toast Notification */}
      {showDuplicateToast && (
        <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-[10000] animate-in fade-in slide-in-from-bottom-5 duration-300">
          <div className="flex items-center gap-3 rounded-lg border border-yellow-600/50 bg-yellow-500/10 px-4 py-3 shadow-lg backdrop-blur-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-500/20">
              <span className="text-lg">⚠️</span>
            </div>
            <div>
              <p className="text-sm font-medium text-yellow-200">Connection Already Exists</p>
              <p className="text-xs text-yellow-300/80">These nodes are already connected</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
