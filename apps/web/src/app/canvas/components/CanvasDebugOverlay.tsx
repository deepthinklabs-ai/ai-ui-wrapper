'use client';

/**
 * Canvas Debug Overlay
 *
 * Admin-only overlay that shows:
 * - Node IDs and labels
 * - Edge IDs and connections
 * - Interactive element labels
 *
 * Toggle with Ctrl+Shift+D
 */

import React, { useState, useEffect } from 'react';
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

  if (!isAdmin || !isVisible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999]">
      {/* Node Labels */}
      {nodes.map((node, index) => (
        <div
          key={node.id}
          className="absolute pointer-events-auto bg-yellow-400/90 text-black px-2 py-1 rounded text-xs font-mono font-bold shadow-lg border-2 border-yellow-600"
          style={{
            left: `${node.position.x}px`,
            top: `${node.position.y - 30}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div>N{index + 1}: {node.label}</div>
          <div className="text-[10px] opacity-70">{node.id.slice(0, 8)}...</div>
        </div>
      ))}

      {/* Edge Labels */}
      {edges.map((edge, index) => {
        const fromNode = nodes.find(n => n.id === edge.from_node_id);
        const toNode = nodes.find(n => n.id === edge.to_node_id);

        if (!fromNode || !toNode) return null;

        // Calculate midpoint
        const midX = (fromNode.position.x + toNode.position.x) / 2;
        const midY = (fromNode.position.y + toNode.position.y) / 2;

        return (
          <div
            key={edge.id}
            className="absolute pointer-events-auto bg-blue-400/90 text-white px-2 py-1 rounded text-xs font-mono font-bold shadow-lg border-2 border-blue-600"
            style={{
              left: `${midX}px`,
              top: `${midY}px`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div>E{index + 1}</div>
            <div className="text-[10px]">{edge.id.slice(0, 8)}...</div>
          </div>
        );
      })}

      {/* Info Panel */}
      <div className="absolute top-4 right-4 bg-slate-900/95 text-white p-4 rounded-lg shadow-2xl border border-slate-700 pointer-events-auto max-w-xs">
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
          <div className="pt-2 border-t border-slate-700 text-slate-400">
            Press <kbd className="bg-slate-800 px-1 rounded">Ctrl+Shift+D</kbd> to toggle
          </div>
        </div>

        {/* Node List */}
        <div className="mt-4 pt-4 border-t border-slate-700">
          <div className="text-xs font-bold mb-2">Nodes:</div>
          <div className="max-h-60 overflow-y-auto space-y-1 text-xs">
            {nodes.map((node, index) => (
              <div key={node.id} className="bg-slate-800 p-2 rounded">
                <div className="font-bold text-yellow-400">N{index + 1}: {node.label}</div>
                <div className="text-slate-500 text-[10px] font-mono">{node.id}</div>
                <div className="text-slate-400 text-[10px]">Type: {node.type}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Edge List */}
        {edges.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="text-xs font-bold mb-2">Edges:</div>
            <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
              {edges.map((edge, index) => {
                const fromNode = nodes.find(n => n.id === edge.from_node_id);
                const toNode = nodes.find(n => n.id === edge.to_node_id);
                return (
                  <div key={edge.id} className="bg-slate-800 p-2 rounded">
                    <div className="font-bold text-blue-400">E{index + 1}</div>
                    <div className="text-slate-400 text-[10px]">
                      {fromNode?.label || '?'} → {toNode?.label || '?'}
                    </div>
                    <div className="text-slate-500 text-[10px] font-mono">{edge.id}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
