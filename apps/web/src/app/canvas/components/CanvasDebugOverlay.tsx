'use client';

/**
 * Canvas Debug Overlay
 *
 * Admin-only overlay that shows:
 * - Node IDs and labels (attached to nodes, move with canvas)
 * - Edge IDs and connections (attached to edge midpoints, move with canvas)
 * - Debug panel with clickable items to highlight on canvas
 * - Copy buttons for IDs
 *
 * Toggle with Ctrl+Shift+D
 *
 * IMPORTANT: This component must be rendered INSIDE ReactFlow to access viewport hooks.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useViewport, useReactFlow, Panel } from '@xyflow/react';
import type { CanvasNode, CanvasEdge } from '../types';

interface CanvasDebugOverlayProps {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  isAdmin: boolean;
}

export default function CanvasDebugOverlay({
  nodes,
  edges,
  isAdmin,
}: CanvasDebugOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const [highlightedEdgeId, setHighlightedEdgeId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [containerOffset, setContainerOffset] = useState({ x: 0, y: 0 });

  // useViewport subscribes to viewport changes and triggers re-renders
  const viewport = useViewport();
  const { getNodes } = useReactFlow();

  // Get the React Flow container position on screen
  useEffect(() => {
    const updateContainerOffset = () => {
      const container = document.querySelector('.react-flow');
      if (container) {
        const rect = container.getBoundingClientRect();
        setContainerOffset({ x: rect.left, y: rect.top });
      }
    };

    updateContainerOffset();
    window.addEventListener('resize', updateContainerOffset);

    // Also update on scroll in case of any scrollable parents
    window.addEventListener('scroll', updateContainerOffset, true);

    return () => {
      window.removeEventListener('resize', updateContainerOffset);
      window.removeEventListener('scroll', updateContainerOffset, true);
    };
  }, [isVisible]);

  // Toggle with Ctrl+Shift+D
  useEffect(() => {
    if (!isAdmin) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault();
        setIsVisible(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin]);

  // Copy to clipboard helper
  const copyToClipboard = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  // Handle node click in panel
  const handleNodeClick = useCallback((nodeId: string) => {
    setHighlightedEdgeId(null);
    setHighlightedNodeId(prev => prev === nodeId ? null : nodeId);
  }, []);

  // Handle edge click in panel
  const handleEdgeClick = useCallback((edgeId: string) => {
    setHighlightedNodeId(null);
    setHighlightedEdgeId(prev => prev === edgeId ? null : edgeId);
  }, []);

  if (!isAdmin || !isVisible) return null;

  // Transform helper - converts flow coordinates to screen position
  // accounting for viewport pan (x, y), zoom, and container offset
  const transformStyle = (flowX: number, flowY: number) => ({
    left: `${flowX * viewport.zoom + viewport.x + containerOffset.x}px`,
    top: `${flowY * viewport.zoom + viewport.y + containerOffset.y}px`,
  });

  return (
    <>
      {/* Node Labels - rendered with viewport transform */}
      {nodes.map((node, index) => {
        const isHighlighted = highlightedNodeId === node.id;
        const style = transformStyle(node.position.x, node.position.y - 40);

        return (
          <div
            key={`node-label-${node.id}`}
            className={`fixed pointer-events-auto px-2 py-1 rounded text-xs font-mono font-bold shadow-lg border-2 z-[9999] transition-all ${
              isHighlighted
                ? 'bg-yellow-300 text-black border-yellow-500 scale-125 ring-4 ring-yellow-400/50'
                : 'bg-yellow-400/90 text-black border-yellow-600'
            }`}
            style={{
              ...style,
              transform: 'translate(-50%, 0)',
              fontSize: `${Math.max(10, 11 * viewport.zoom)}px`,
            }}
          >
            <div className="flex items-center gap-1">
              <span>N{index + 1}: {node.label}</span>
              <button
                onClick={() => copyToClipboard(node.id, `node-${node.id}`)}
                className="ml-1 px-1 hover:bg-yellow-500 rounded"
                title="Copy Node ID"
              >
                {copiedId === `node-${node.id}` ? '✓' : '📋'}
              </button>
            </div>
            <div className="opacity-70" style={{ fontSize: `${Math.max(8, 9 * viewport.zoom)}px` }}>
              {node.id.slice(0, 12)}...
            </div>
          </div>
        );
      })}

      {/* Edge Labels - positioned at midpoint with viewport transform */}
      {edges.map((edge, index) => {
        const fromNode = nodes.find(n => n.id === edge.from_node_id);
        const toNode = nodes.find(n => n.id === edge.to_node_id);

        if (!fromNode || !toNode) return null;

        // Calculate midpoint in flow coordinates
        const midX = (fromNode.position.x + toNode.position.x) / 2;
        const midY = (fromNode.position.y + toNode.position.y) / 2;
        const isHighlighted = highlightedEdgeId === edge.id;
        const style = transformStyle(midX, midY);

        return (
          <div
            key={`edge-label-${edge.id}`}
            className={`fixed pointer-events-auto px-2 py-1 rounded text-xs font-mono font-bold shadow-lg border-2 z-[9998] transition-all ${
              isHighlighted
                ? 'bg-blue-300 text-black border-blue-500 scale-125 ring-4 ring-blue-400/50'
                : 'bg-blue-400/90 text-white border-blue-600'
            }`}
            style={{
              ...style,
              transform: 'translate(-50%, -50%)',
              fontSize: `${Math.max(10, 11 * viewport.zoom)}px`,
            }}
          >
            <div className="flex items-center gap-1">
              <span>E{index + 1}</span>
              <button
                onClick={() => copyToClipboard(edge.id, `edge-${edge.id}`)}
                className="ml-1 px-1 hover:bg-blue-500 rounded"
                title="Copy Edge ID"
              >
                {copiedId === `edge-${edge.id}` ? '✓' : '📋'}
              </button>
            </div>
            <div style={{ fontSize: `${Math.max(8, 9 * viewport.zoom)}px` }}>
              {edge.id.slice(0, 12)}...
            </div>
          </div>
        );
      })}

      {/* Info Panel - fixed position in top-right using React Flow Panel */}
      <Panel position="top-right" className="pointer-events-auto">
        <div className="bg-slate-900/95 text-white p-4 rounded-lg shadow-2xl border border-slate-700 max-w-xs max-h-[80vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-sm">Debug Overlay</h3>
            <button
              onClick={() => setIsVisible(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2 text-xs font-mono">
            <div className="flex justify-between">
              <span className="text-slate-400">Nodes:</span>
              <span className="font-bold">{nodes.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Edges:</span>
              <span className="font-bold">{edges.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Zoom:</span>
              <span className="font-bold">{viewport.zoom.toFixed(2)}x</span>
            </div>
            <div className="pt-2 border-t border-slate-700 text-slate-400">
              Press <kbd className="bg-slate-800 px-1 rounded">Ctrl+Shift+D</kbd> to toggle
            </div>
          </div>

          {/* Node List - Clickable */}
          <div className="mt-4 pt-4 border-t border-slate-700 flex-1 overflow-hidden flex flex-col">
            <div className="text-xs font-bold mb-2 flex items-center gap-2">
              <span className="w-3 h-3 bg-yellow-400 rounded"></span>
              Nodes (click to highlight):
            </div>
            <div className="flex-1 overflow-y-auto space-y-1 text-xs pr-1">
              {nodes.map((node, index) => {
                const isHighlighted = highlightedNodeId === node.id;
                return (
                  <div
                    key={node.id}
                    className={`p-2 rounded cursor-pointer transition-all ${
                      isHighlighted
                        ? 'bg-yellow-500/30 ring-2 ring-yellow-400'
                        : 'bg-slate-800 hover:bg-slate-700'
                    }`}
                    onClick={() => handleNodeClick(node.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`font-bold ${isHighlighted ? 'text-yellow-300' : 'text-yellow-400'}`}>
                        N{index + 1}: {node.label}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(node.id, `panel-node-${node.id}`);
                        }}
                        className="text-slate-400 hover:text-white px-1"
                        title="Copy full ID"
                      >
                        {copiedId === `panel-node-${node.id}` ? '✓' : '📋'}
                      </button>
                    </div>
                    <div className="text-slate-500 text-[10px] font-mono truncate">{node.id}</div>
                    <div className="text-slate-400 text-[10px]">Type: {node.type}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Edge List - Clickable */}
          {edges.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-700 flex-1 overflow-hidden flex flex-col">
              <div className="text-xs font-bold mb-2 flex items-center gap-2">
                <span className="w-3 h-3 bg-blue-400 rounded"></span>
                Edges (click to highlight):
              </div>
              <div className="flex-1 overflow-y-auto space-y-1 text-xs pr-1">
                {edges.map((edge, index) => {
                  const fromNode = nodes.find(n => n.id === edge.from_node_id);
                  const toNode = nodes.find(n => n.id === edge.to_node_id);
                  const isHighlighted = highlightedEdgeId === edge.id;
                  return (
                    <div
                      key={edge.id}
                      className={`p-2 rounded cursor-pointer transition-all ${
                        isHighlighted
                          ? 'bg-blue-500/30 ring-2 ring-blue-400'
                          : 'bg-slate-800 hover:bg-slate-700'
                      }`}
                      onClick={() => handleEdgeClick(edge.id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-bold ${isHighlighted ? 'text-blue-300' : 'text-blue-400'}`}>
                          E{index + 1}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            copyToClipboard(edge.id, `panel-edge-${edge.id}`);
                          }}
                          className="text-slate-400 hover:text-white px-1"
                          title="Copy full ID"
                        >
                          {copiedId === `panel-edge-${edge.id}` ? '✓' : '📋'}
                        </button>
                      </div>
                      <div className="text-slate-400 text-[10px]">
                        {fromNode?.label || '?'} → {toNode?.label || '?'}
                      </div>
                      <div className="text-slate-500 text-[10px] font-mono truncate">{edge.id}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Panel>
    </>
  );
}
