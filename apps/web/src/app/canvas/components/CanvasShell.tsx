'use client';

/**
 * Canvas Shell
 *
 * Main container for the Canvas feature with:
 * - Left sidebar: Canvas list + Node palette
 * - Center: React Flow canvas
 * - Right sidebar: Node inspector
 * - Top toolbar: Controls + mode toggles
 */

import React, { useState, useCallback } from 'react';
import type {
  Canvas,
  CanvasNode,
  CanvasEdge,
  CanvasId,
  NodeId,
  EdgeId,
  CanvasNodeType,
} from '../types';
import NodePalette from './NodePalette';
import CanvasViewport from './CanvasViewport';
import NodeInspector from './NodeInspector';
import WorkflowControls from './WorkflowControls';
import CanvasDebugOverlay from './CanvasDebugOverlay';
import { CanvasProvider } from '../context/CanvasContext';
import { useAuthSession } from '@/hooks/useAuthSession';

interface CanvasShellProps {
  // Canvas management
  canvases: Canvas[];
  currentCanvas: Canvas | null;
  onSelectCanvas: (canvas: Canvas | null) => void;
  onCreateCanvas: () => void;
  onUpdateCanvas: (id: CanvasId, updates: Partial<Canvas>) => Promise<boolean>;
  onDeleteCanvas: (id: CanvasId) => Promise<boolean>;

  // Nodes
  nodes: CanvasNode[];
  onAddNode: (type: CanvasNodeType, position: { x: number; y: number }, config?: any) => Promise<CanvasNode | null>;
  onUpdateNode: (id: NodeId, updates: Partial<CanvasNode>) => Promise<boolean>;
  onDeleteNode: (id: NodeId) => Promise<boolean>;
  onDuplicateNode: (id: NodeId) => Promise<CanvasNode | null>;

  // Edges
  edges: CanvasEdge[];
  onAddEdge: (from: NodeId, to: NodeId, config?: Partial<CanvasEdge>) => Promise<CanvasEdge | null>;
  onUpdateEdge: (id: EdgeId, updates: Partial<CanvasEdge>) => Promise<boolean>;
  onDeleteEdge: (id: EdgeId) => Promise<boolean>;

  // Loading
  loading?: boolean;
}

export default function CanvasShell({
  canvases,
  currentCanvas,
  onSelectCanvas,
  onCreateCanvas,
  onUpdateCanvas,
  onDeleteCanvas,
  nodes,
  onAddNode,
  onUpdateNode,
  onDeleteNode,
  onDuplicateNode,
  edges,
  onAddEdge,
  onUpdateEdge,
  onDeleteEdge,
  loading,
}: CanvasShellProps) {
  const { user } = useAuthSession();
  const [selectedNodeId, setSelectedNodeId] = useState<NodeId | null>(null);
  const [showNodePalette, setShowNodePalette] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [workflowMode, setWorkflowMode] = useState(false);

  // Check if user is admin
  const isAdmin = user?.email === 'dave@deepthinklabs.ai';

  // Get selected node
  const selectedNode = selectedNodeId
    ? nodes.find(n => n.id === selectedNodeId) || null
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

      const newNode = await onAddNode(type, { x: centerX, y: centerY });
      if (newNode) {
        setSelectedNodeId(newNode.id);
        setShowInspector(true);
      }
    },
    [onAddNode]
  );

  return (
    <div className="flex h-screen flex-col bg-slate-950">
      {/* Top Toolbar */}
      <div className="border-b border-slate-800 bg-slate-900 px-4 py-3">
        <WorkflowControls
          currentCanvas={currentCanvas}
          canvases={canvases}
          onSelectCanvas={onSelectCanvas}
          onCreateCanvas={onCreateCanvas}
          onUpdateCanvas={onUpdateCanvas}
          onDeleteCanvas={onDeleteCanvas}
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
          {currentCanvas ? (
            <CanvasProvider
              value={{
                nodes,
                edges,
                onAddNode,
                onUpdateNode,
                onDeleteNode,
                onDuplicateNode,
                onAddEdge,
                onUpdateEdge,
                onDeleteEdge,
              }}
            >
              <CanvasViewport
                nodes={nodes}
                edges={edges}
                selectedNodeId={selectedNodeId}
                onNodeClick={handleNodeClick}
                onCanvasClick={handleCanvasClick}
                onNodesChange={(changes) => {
                  // Handle node position changes
                  changes.forEach((change) => {
                    if (change.type === 'position' && change.position) {
                      onUpdateNode(change.id, { position: change.position });
                    } else if (change.type === 'remove') {
                      onDeleteNode(change.id);
                    }
                  });
                }}
                onEdgesChange={(changes) => {
                  // Handle edge changes
                  changes.forEach((change) => {
                    if (change.type === 'remove') {
                      onDeleteEdge(change.id);
                    }
                  });
                }}
                onConnect={(connection) => {
                  // Handle new edge connection
                  if (connection.source && connection.target) {
                    onAddEdge(connection.source, connection.target, {
                      from_port: connection.sourceHandle || undefined,
                      to_port: connection.targetHandle || undefined,
                    });
                  }
                }}
                workflowMode={workflowMode}
              />

              {/* Admin Debug Overlay */}
              <CanvasDebugOverlay
                nodes={nodes}
                edges={edges}
                isAdmin={isAdmin}
              />
            </CanvasProvider>
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-slate-400">No canvas selected</p>
            </div>
          )}

          {/* Loading Overlay */}
          {loading && (
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
                  onUpdateNode(selectedNode.id, updates);
                }
              }}
              onDeleteNode={() => {
                if (selectedNode) {
                  onDeleteNode(selectedNode.id);
                  setSelectedNodeId(null);
                }
              }}
              onDuplicateNode={() => {
                if (selectedNode) {
                  onDuplicateNode(selectedNode.id);
                }
              }}
              onClose={() => setSelectedNodeId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
