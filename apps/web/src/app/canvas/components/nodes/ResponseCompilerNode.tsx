'use client';

/**
 * Response Compiler Node Component
 *
 * Displays a Response Compiler node in the canvas.
 * This node collects and synthesizes responses from multiple AI Agents
 * into a single cohesive answer.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { ResponseCompilerNodeConfig } from '../../types';
import { useCanvasContext } from '../../context/CanvasContext';

export interface ResponseCompilerNodeData {
  label: string;
  config: ResponseCompilerNodeConfig;
  nodeType: string;
}

export default function ResponseCompilerNode({ id, data, selected }: NodeProps<any>) {
  const nodeData = data as ResponseCompilerNodeData;
  const { nodes, edges, onUpdateNode } = useCanvasContext();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editName, setEditName] = useState(nodeData.config.name);
  const [editDescription, setEditDescription] = useState(nodeData.config.description || '');

  // Count upstream connections
  const upstreamCount = useMemo(() => {
    return edges.filter(e => e.to_node_id === id).length;
  }, [id, edges]);

  // Get upstream agent names
  const upstreamAgents = useMemo(() => {
    const incomingEdges = edges.filter(e => e.to_node_id === id);
    return incomingEdges.map(edge => {
      const sourceNode = nodes.find(n => n.id === edge.from_node_id);
      if (sourceNode) {
        const config = sourceNode.config as any;
        return config.name || sourceNode.label || 'Unknown Agent';
      }
      return 'Unknown';
    });
  }, [id, nodes, edges]);

  /**
   * Persist config changes
   */
  const persistConfig = useCallback(async (newConfig: Partial<ResponseCompilerNodeConfig>) => {
    setIsSaving(true);
    try {
      const mergedConfig = {
        ...nodeData.config,
        ...newConfig,
      };

      const success = await onUpdateNode(id, { config: mergedConfig });

      if (!success) {
        console.error('[ResponseCompilerNode] Error saving config');
        return false;
      }

      console.log('[ResponseCompilerNode] Config saved:', newConfig);
      return true;
    } catch (err) {
      console.error('[ResponseCompilerNode] Error saving config:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [id, nodeData.config, onUpdateNode]);

  /**
   * Save edited configuration
   */
  const handleSaveConfig = useCallback(async () => {
    const success = await persistConfig({
      name: editName,
      description: editDescription,
    });
    if (success) {
      setIsEditing(false);
    }
  }, [editName, editDescription, persistConfig]);

  /**
   * Cancel editing
   */
  const handleCancelEdit = useCallback(() => {
    setEditName(nodeData.config.name);
    setEditDescription(nodeData.config.description || '');
    setIsEditing(false);
  }, [nodeData.config]);

  // Get strategy display name
  const getStrategyDisplay = (strategy: string): string => {
    switch (strategy) {
      case 'ai_summarize': return 'AI Summarization';
      case 'concatenate': return 'Concatenate All';
      case 'prioritized': return 'Prioritized';
      default: return strategy;
    }
  };

  // Get output format display
  const getFormatDisplay = (format: string): string => {
    switch (format) {
      case 'prose': return 'Prose';
      case 'bullet_points': return 'Bullet Points';
      case 'structured': return 'Structured';
      default: return format;
    }
  };

  return (
    <div
      data-node-id={id}
      className={`
        rounded-lg border-2 bg-slate-800 shadow-lg min-w-[260px]
        transition-all
        ${selected ? 'border-teal-500 ring-2 ring-teal-500/50' : 'border-slate-600'}
      `}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="responses"
        className="!bg-teal-500 !border-2 !border-slate-900"
      />

      <div className="p-4">
        {/* Node Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="text-3xl">
            <span role="img" aria-label="compiler">📋</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-100 text-sm truncate">
              {nodeData.config.name}
            </div>
            <div className="text-xs text-teal-400">
              Response Compiler
            </div>
          </div>
        </div>

        {isEditing ? (
          /* Edit Mode */
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-teal-500"
                placeholder="Compiler name"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-teal-500 resize-none"
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveConfig}
                disabled={isSaving}
                className="flex-1 px-3 py-1 text-xs bg-teal-600 hover:bg-teal-700 text-white rounded transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={handleCancelEdit}
                disabled={isSaving}
                className="flex-1 px-3 py-1 text-xs bg-slate-600 hover:bg-slate-500 text-slate-200 rounded transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* View Mode */
          <>
            {/* Configuration Display */}
            <div className="space-y-2 text-xs">
              {/* Compilation Strategy */}
              <div className="p-2 bg-slate-700/50 rounded">
                <div className="text-slate-400 mb-1">Compilation Strategy:</div>
                <div className="text-slate-200 font-medium">
                  {getStrategyDisplay(nodeData.config.compilation_strategy)}
                </div>
              </div>

              {/* Output Format */}
              <div className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                <span className="text-slate-400">Output Format:</span>
                <span className="text-slate-200 font-medium">
                  {getFormatDisplay(nodeData.config.output_format)}
                </span>
              </div>

              {/* Source Attribution */}
              <div className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                <span className="text-slate-400">Source Attribution:</span>
                <span className={`font-medium ${nodeData.config.include_source_attribution ? 'text-green-400' : 'text-slate-500'}`}>
                  {nodeData.config.include_source_attribution ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              {/* Upstream Connections */}
              <div className="p-2 bg-slate-700/50 rounded">
                <div className="text-slate-400 mb-1">Upstream Sources ({upstreamCount}):</div>
                {upstreamAgents.length > 0 ? (
                  <div className="space-y-1">
                    {upstreamAgents.map((name, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-slate-300">
                        <span className="text-teal-400">←</span>
                        <span className="truncate">{name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500 italic">
                    No sources connected
                  </div>
                )}
              </div>

              {/* Usage Stats */}
              {nodeData.config.compilation_count !== undefined && nodeData.config.compilation_count > 0 && (
                <div className="flex items-center justify-between text-slate-500">
                  <span>Compilations:</span>
                  <span className="text-slate-300">{nodeData.config.compilation_count}</span>
                </div>
              )}
            </div>

            {/* Edit Button */}
            <div className="mt-3 pt-3 border-t border-slate-700">
              <button
                onClick={() => setIsEditing(true)}
                className="w-full px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 rounded transition-colors"
              >
                Edit Configuration
              </button>
            </div>

            {/* Status Hint */}
            <div className="mt-2 text-center">
              <div className={`text-xs ${upstreamCount > 0 ? 'text-teal-400' : 'text-slate-500'}`}>
                {upstreamCount > 0
                  ? `Ready to compile ${upstreamCount} source${upstreamCount > 1 ? 's' : ''}`
                  : 'Connect agents to compile responses'
                }
              </div>
            </div>
          </>
        )}
      </div>

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="compiled"
        className="!bg-teal-500 !border-2 !border-slate-900"
      />
    </div>
  );
}
