/**
 * SSMAgentNode Component
 *
 * Visual representation of a State-Space Model (SSM) node in the Canvas.
 * Rules-based event monitoring with $0 runtime cost.
 *
 * Features:
 * - LLM generates rules at setup time (one-time cost)
 * - Pure pattern matching at runtime ($0)
 * - On/off toggle to start/stop monitoring
 * - Three severity outputs: Info, Warning, Critical (→ AI Agent)
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { SSMAgentNodeConfig } from '../../types/ssm';
import { getEventSourceInfo, hasRulesConfigured, countEnabledRules } from '../../features/ssm-agent/lib/ssmDefaults';
import { useCanvasContext } from '../../context/CanvasContext';

// ============================================================================
// TYPES
// ============================================================================

export interface SSMAgentNodeData {
  label: string;
  config: SSMAgentNodeConfig;
  nodeType: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SSMAgentNode({ id, data, selected }: NodeProps<any>) {
  const nodeData = data as SSMAgentNodeData;
  const { onUpdateNode } = useCanvasContext();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(nodeData.config.name);
  const [isToggling, setIsToggling] = useState(false);

  // Get display info
  const eventSourceInfo = useMemo(() => {
    return getEventSourceInfo(nodeData.config.event_source_type);
  }, [nodeData.config.event_source_type]);

  const rulesConfigured = useMemo(() => {
    return hasRulesConfigured(nodeData.config.rules);
  }, [nodeData.config.rules]);

  const enabledRulesCount = useMemo(() => {
    return countEnabledRules(nodeData.config.rules);
  }, [nodeData.config.rules]);

  const isEnabled = nodeData.config.is_enabled ?? false;
  const isTrained = !!nodeData.config.trained_at;

  // Handle name editing
  const handleSaveName = useCallback(() => {
    setIsEditing(false);
  }, []);

  // Handle toggle on/off
  const handleToggle = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger node selection
    if (isToggling) return;

    // Don't allow enabling if not trained
    if (!isTrained && !isEnabled) {
      return;
    }

    setIsToggling(true);
    try {
      await onUpdateNode(id, {
        config: { ...nodeData.config, is_enabled: !isEnabled },
      });
    } finally {
      setIsToggling(false);
    }
  }, [id, nodeData.config, isEnabled, isTrained, isToggling, onUpdateNode]);

  // Determine status based on configuration and enabled state
  const status = useMemo(() => {
    if (!isTrained) {
      return { color: 'bg-gray-400', text: 'Not Trained', textColor: 'text-gray-600' };
    }
    if (!rulesConfigured) {
      return { color: 'bg-gray-400', text: 'No Rules', textColor: 'text-gray-600' };
    }
    if (!isEnabled) {
      return { color: 'bg-amber-400', text: 'Paused', textColor: 'text-amber-600' };
    }
    return { color: 'bg-green-400 animate-pulse', text: 'Monitoring', textColor: 'text-green-600' };
  }, [isTrained, rulesConfigured, isEnabled]);

  return (
    <div
      data-node-id={id}
      className={`
        min-w-[220px] rounded-xl border-2 bg-white/90 backdrop-blur-sm shadow-lg
        transition-all duration-200
        ${selected
          ? 'border-teal-500 ring-2 ring-teal-500/30 shadow-teal-500/20'
          : 'border-teal-400/50 hover:border-teal-400'
        }
      `}
    >
      {/* Input Handle (optional - for manual trigger or chaining) */}
      <Handle
        type="target"
        position={Position.Left}
        id="trigger"
        className="!w-3 !h-3 !bg-teal-500 !border-2 !border-white"
        style={{ top: '50%' }}
        title="Optional Trigger"
      />

      {/* Header */}
      <div className="px-4 py-3 border-b border-teal-100 bg-gradient-to-r from-teal-50 to-cyan-50 rounded-t-xl">
        <div className="flex items-center gap-2">
          <span className="text-xl">📊</span>
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              className="flex-1 px-2 py-1 text-sm font-semibold bg-white border border-teal-200 rounded focus:outline-none focus:ring-2 focus:ring-teal-500"
              autoFocus
            />
          ) : (
            <span
              className="flex-1 font-semibold text-teal-900 cursor-pointer hover:text-teal-700 truncate"
              onClick={() => setIsEditing(true)}
              title="Click to edit name"
            >
              {nodeData.config.name || nodeData.label}
            </span>
          )}

          {/* On/Off Toggle */}
          <button
            onClick={handleToggle}
            disabled={!isTrained || isToggling}
            className={`
              relative inline-flex h-5 w-9 items-center rounded-full transition-colors
              ${!isTrained ? 'bg-gray-200 cursor-not-allowed opacity-50' : isEnabled ? 'bg-green-500' : 'bg-gray-300 hover:bg-gray-400'}
              ${isToggling ? 'opacity-50' : ''}
            `}
            title={!isTrained ? 'Complete training first' : isEnabled ? 'Click to pause monitoring' : 'Click to start monitoring'}
          >
            <span
              className={`
                inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
                ${isEnabled ? 'translate-x-4' : 'translate-x-0.5'}
              `}
            />
          </button>
        </div>
        <p className="text-xs text-teal-600 mt-1">Polling Monitor</p>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        {/* Training Status */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground/60">Training:</span>
          {isTrained ? (
            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">
              Trained
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
              Not trained
            </span>
          )}
        </div>

        {/* Rules Summary (only show if trained) */}
        {isTrained && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground/60">Rules:</span>
            <span className="font-medium text-teal-700">
              {enabledRulesCount} active
            </span>
          </div>
        )}

        {/* Event Source */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground/60">Source:</span>
          <span className="flex items-center gap-1">
            <span>{eventSourceInfo?.icon}</span>
            <span className="text-foreground/80 text-xs">
              {eventSourceInfo?.label}
            </span>
          </span>
        </div>

        {/* Stats (if available) */}
        {(nodeData.config.events_processed ?? 0) > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground/60">Processed:</span>
            <span className="text-foreground/80">
              {nodeData.config.events_processed} events
            </span>
          </div>
        )}

        {/* Status Indicator */}
        <div className="flex items-center justify-between text-sm pt-2 border-t border-foreground/10">
          <span className="text-foreground/60">Status:</span>
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${status.color}`} />
            <span className={`text-xs ${status.textColor}`}>{status.text}</span>
          </span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-teal-100 bg-teal-50/50 rounded-b-xl">
        {isTrained && nodeData.config.training_summary ? (
          <p className="text-xs text-teal-700 truncate" title={nodeData.config.training_summary}>
            {nodeData.config.training_summary}
          </p>
        ) : isTrained && nodeData.config.monitoring_description ? (
          <p className="text-xs text-teal-700 truncate" title={nodeData.config.monitoring_description}>
            {nodeData.config.monitoring_description}
          </p>
        ) : (
          <div className="flex items-center gap-2 text-teal-600">
            <span className="text-sm">🎓</span>
            <span className="text-xs">Click to train in Node Inspector</span>
          </div>
        )}
      </div>

      {/* Output Handle - Sends alerts to connected nodes */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        className="!w-3 !h-3 !bg-teal-500 !border-2 !border-white"
        style={{ top: '50%' }}
        title="Alert Output (to AI Agent)"
      />
    </div>
  );
}
