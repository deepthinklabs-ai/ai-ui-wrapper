'use client';

/**
 * Master Trigger Node Component
 *
 * Displays a Master Genesis Bot Trigger node in the canvas.
 * This node type allows workflows to be triggered from the main Genesis Bot page.
 */

import React, { useState, useCallback } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { MasterTriggerNodeConfig } from '../../types';
import { useCanvasContext } from '../../context/CanvasContext';

export interface MasterTriggerNodeData {
  label: string;
  config: MasterTriggerNodeConfig;
  nodeType: string;
}

export default function MasterTriggerNode({ id, data, selected }: NodeProps<any>) {
  const nodeData = data as MasterTriggerNodeData;
  const { onUpdateNode } = useCanvasContext();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState(nodeData.config.display_name);
  const [editDescription, setEditDescription] = useState(nodeData.config.description || '');

  const isExposed = nodeData.config.is_exposed;

  /**
   * Persist config changes using context (updates both DB and parent state)
   */
  const persistConfig = useCallback(async (newConfig: Partial<MasterTriggerNodeConfig>) => {
    setIsSaving(true);
    try {
      const mergedConfig = {
        ...nodeData.config,
        ...newConfig,
      };

      // Use context's onUpdateNode which updates both DB and parent state
      const success = await onUpdateNode(id, { config: mergedConfig });

      if (!success) {
        console.error('[MasterTriggerNode] Error saving config');
        return false;
      }

      console.log('[MasterTriggerNode] Config saved:', newConfig);
      return true;
    } catch (err) {
      console.error('[MasterTriggerNode] Error saving config:', err);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [id, nodeData.config, onUpdateNode]);

  /**
   * Toggle exposure status
   */
  const handleToggleExposure = useCallback(async () => {
    await persistConfig({ is_exposed: !isExposed });
  }, [isExposed, persistConfig]);

  /**
   * Save edited configuration
   */
  const handleSaveConfig = useCallback(async () => {
    const success = await persistConfig({
      display_name: editDisplayName,
      description: editDescription,
    });
    if (success) {
      setIsEditing(false);
    }
  }, [editDisplayName, editDescription, persistConfig]);

  /**
   * Cancel editing
   */
  const handleCancelEdit = useCallback(() => {
    setEditDisplayName(nodeData.config.display_name);
    setEditDescription(nodeData.config.description || '');
    setIsEditing(false);
  }, [nodeData.config]);

  return (
    <div
      data-node-id={id}
      className={`
        rounded-lg border-2 bg-slate-800 shadow-lg min-w-[250px]
        transition-all
        ${selected ? 'border-purple-500 ring-2 ring-purple-500/50' : 'border-slate-600'}
        ${isExposed ? 'ring-1 ring-green-500/30' : ''}
      `}
    >
      {/* No input handle - this is a trigger/entry point */}

      <div className="p-4">
        {/* Node Header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="text-3xl relative">
            <span role="img" aria-label="trigger">🎯</span>
            {/* Exposure indicator */}
            {isExposed && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border border-slate-800" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-100 text-sm truncate">
              {nodeData.label}
            </div>
            <div className="text-xs text-purple-400">
              Master Trigger
            </div>
          </div>
        </div>

        {isEditing ? (
          /* Edit Mode */
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Display Name</label>
              <input
                type="text"
                value={editDisplayName}
                onChange={(e) => setEditDisplayName(e.target.value)}
                className="w-full px-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-purple-500"
                placeholder="Workflow name in dropdown"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Description (optional)</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full px-2 py-1 text-sm bg-slate-700 border border-slate-600 rounded text-slate-200 focus:outline-none focus:border-purple-500 resize-none"
                placeholder="Brief description for the dropdown"
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveConfig}
                disabled={isSaving}
                className="flex-1 px-3 py-1 text-xs bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors disabled:opacity-50"
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
              <div className="p-2 bg-slate-700/50 rounded">
                <div className="text-slate-400 mb-1">Dropdown Name:</div>
                <div className="text-slate-200 font-medium">
                  {nodeData.config.display_name || 'Not set'}
                </div>
              </div>

              {nodeData.config.description && (
                <div className="p-2 bg-slate-700/50 rounded">
                  <div className="text-slate-400 mb-1">Description:</div>
                  <div className="text-slate-300 text-xs">
                    {nodeData.config.description}
                  </div>
                </div>
              )}

              {/* Exposure Status */}
              <div className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                <span className="text-slate-400">Exposed:</span>
                <button
                  onClick={handleToggleExposure}
                  disabled={isSaving}
                  className={`
                    px-2 py-0.5 rounded text-xs font-medium transition-colors
                    ${isExposed
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                    }
                    ${isSaving ? 'opacity-50 cursor-wait' : ''}
                  `}
                >
                  {isSaving ? '...' : isExposed ? 'Yes' : 'No'}
                </button>
              </div>

              {/* Usage Stats */}
              {nodeData.config.trigger_count !== undefined && nodeData.config.trigger_count > 0 && (
                <div className="flex items-center justify-between text-slate-500">
                  <span>Triggered:</span>
                  <span className="text-slate-300">{nodeData.config.trigger_count} times</span>
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
              <div className={`text-xs ${isExposed ? 'text-green-400' : 'text-slate-500'}`}>
                {isExposed
                  ? 'Visible in AI Agent dropdown'
                  : 'Enable exposure to show in AI Agent'
                }
              </div>
            </div>
          </>
        )}
      </div>

      {/* Output Handle - connects to AI Agent nodes */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="!bg-purple-500 !border-2 !border-slate-900"
      />
    </div>
  );
}
