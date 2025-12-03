'use client';

/**
 * Smart Router Node Component
 *
 * Displays a Smart Router node in the canvas.
 * This node intelligently routes queries to appropriate AI Agents
 * based on their capabilities and integrations.
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { SmartRouterNodeConfig, ConnectedAgentInfo, IntegrationType } from '../../types';
import { useCanvasContext } from '../../context/CanvasContext';

export interface SmartRouterNodeData {
  label: string;
  config: SmartRouterNodeConfig;
  nodeType: string;
}

export default function SmartRouterNode({ id, data, selected }: NodeProps<any>) {
  const nodeData = data as SmartRouterNodeData;
  const { nodes, edges, onUpdateNode } = useCanvasContext();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editName, setEditName] = useState(nodeData.config.name);
  const [editDescription, setEditDescription] = useState(nodeData.config.description || '');

  // Detect connected agents and their integrations
  const connectedAgents = useMemo(() => {
    const outgoingEdges = edges.filter(e => e.from_node_id === id);
    const agentInfos: ConnectedAgentInfo[] = [];

    outgoingEdges.forEach(edge => {
      const targetNode = nodes.find(n => n.id === edge.to_node_id);
      if (targetNode && targetNode.type === 'GENESIS_BOT') {
        const config = targetNode.config as any;
        const integrations: IntegrationType[] = [];
        const capabilities: string[] = [];

        if (config.gmail?.enabled) {
          integrations.push('gmail');
          capabilities.push('Email');
        }
        if (config.calendar?.enabled) {
          integrations.push('calendar');
          capabilities.push('Calendar');
        }
        if (config.sheets?.enabled) {
          integrations.push('sheets');
          capabilities.push('Sheets');
        }
        if (config.docs?.enabled) {
          integrations.push('docs');
          capabilities.push('Docs');
        }
        if (config.slack?.enabled) {
          integrations.push('slack');
          capabilities.push('Slack');
        }

        agentInfos.push({
          nodeId: targetNode.id,
          name: config.name || targetNode.label,
          integrations,
          capabilities: capabilities.length > 0 ? capabilities : ['General AI'],
        });
      }
    });

    return agentInfos;
  }, [id, nodes, edges]);

  /**
   * Persist config changes
   */
  const persistConfig = useCallback(async (newConfig: Partial<SmartRouterNodeConfig>) => {
    setIsSaving(true);
    try {
      const mergedConfig = {
        ...nodeData.config,
        ...newConfig,
      };

      const success = await onUpdateNode(id, { config: mergedConfig });

      if (!success) {
        console.error('[SmartRouterNode] Error saving config');
        return false;
      }

      console.log('[SmartRouterNode] Config saved:', newConfig);
      return true;
    } catch (err) {
      console.error('[SmartRouterNode] Error saving config:', err);
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

  // Get integration icon
  const getIntegrationIcon = (type: IntegrationType): string => {
    switch (type) {
      case 'gmail': return '📧';
      case 'calendar': return '📅';
      case 'sheets': return '📊';
      case 'docs': return '📄';
      case 'slack': return '💬';
      default: return '🔧';
    }
  };

  return (
    <div
      data-node-id={id}
      className={`
        rounded-lg border-2 bg-slate-800 shadow-lg min-w-[280px]
        transition-all
        ${selected ? 'border-cyan-500 ring-2 ring-cyan-500/50' : 'border-slate-600'}
      `}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        className="!bg-cyan-500 !border-2 !border-slate-900"
      />

      <div className="p-4">
        {/* Node Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="text-3xl">
            <span role="img" aria-label="router">🔀</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-100 text-sm truncate">
              {nodeData.config.name}
            </div>
            <div className="text-xs text-cyan-400">
              Smart Router
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
                className="w-full px-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-cyan-500"
                placeholder="Router name"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-cyan-500 resize-none"
                placeholder="Optional description"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveConfig}
                disabled={isSaving}
                className="flex-1 px-3 py-1 text-xs bg-cyan-600 hover:bg-cyan-700 text-white rounded transition-colors disabled:opacity-50"
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
              {/* Routing Strategy */}
              <div className="p-2 bg-slate-700/50 rounded">
                <div className="text-slate-400 mb-1">Routing Strategy:</div>
                <div className="text-slate-200 font-medium capitalize">
                  {nodeData.config.routing_strategy.replace(/_/g, ' → ')}
                </div>
              </div>

              {/* Connected Agents */}
              <div className="p-2 bg-slate-700/50 rounded">
                <div className="text-slate-400 mb-2">Connected Agents ({connectedAgents.length}):</div>
                {connectedAgents.length > 0 ? (
                  <div className="space-y-1.5">
                    {connectedAgents.map(agent => (
                      <div key={agent.nodeId} className="flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {agent.integrations.length > 0 ? (
                            agent.integrations.map(int => (
                              <span key={int} title={int}>
                                {getIntegrationIcon(int)}
                              </span>
                            ))
                          ) : (
                            <span title="General AI">🤖</span>
                          )}
                        </div>
                        <span className="text-slate-300 truncate">{agent.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-slate-500 italic">
                    No agents connected. Connect AI Agents to enable routing.
                  </div>
                )}
              </div>

              {/* Parallel Routing */}
              <div className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                <span className="text-slate-400">Parallel Routing:</span>
                <span className={`font-medium ${nodeData.config.allow_parallel_routing ? 'text-green-400' : 'text-slate-500'}`}>
                  {nodeData.config.allow_parallel_routing ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              {/* Usage Stats */}
              {nodeData.config.routing_count !== undefined && nodeData.config.routing_count > 0 && (
                <div className="flex items-center justify-between text-slate-500">
                  <span>Routes processed:</span>
                  <span className="text-slate-300">{nodeData.config.routing_count}</span>
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
              <div className={`text-xs ${connectedAgents.length > 0 ? 'text-cyan-400' : 'text-slate-500'}`}>
                {connectedAgents.length > 0
                  ? `Ready to route to ${connectedAgents.length} agent${connectedAgents.length > 1 ? 's' : ''}`
                  : 'Connect AI Agents to enable routing'
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
        id="output"
        className="!bg-cyan-500 !border-2 !border-slate-900"
      />
    </div>
  );
}
