/**
 * SSMAgentNode Component
 *
 * Visual representation of a Stream Monitor node in the Canvas.
 * Rules-based event monitoring with $0 runtime cost.
 *
 * Features:
 * - LLM generates rules at setup time (one-time cost)
 * - Pure pattern matching at runtime ($0)
 * - Three severity outputs: Info, Warning, Critical (→ AI Agent)
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { SSMAgentNodeConfig } from '../../types/ssm';
import { getEventSourceInfo, hasRulesConfigured, countEnabledRules } from '../../features/ssm-agent/lib/ssmDefaults';

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
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(nodeData.config.name);

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

  // Handle name editing
  const handleSaveName = useCallback(() => {
    setIsEditing(false);
  }, []);

  // Determine status based on rules configuration
  const status = useMemo(() => {
    if (!rulesConfigured) {
      return { color: 'bg-gray-400', text: 'Setup Required', textColor: 'text-gray-600' };
    }
    if (enabledRulesCount === 0) {
      return { color: 'bg-amber-400', text: 'No Active Rules', textColor: 'text-amber-600' };
    }
    return { color: 'bg-green-400 animate-pulse', text: 'Ready', textColor: 'text-green-600' };
  }, [rulesConfigured, enabledRulesCount]);

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
      {/* Input Handles */}
      <Handle
        type="target"
        position={Position.Left}
        id="trigger"
        className="!w-3 !h-3 !bg-teal-500 !border-2 !border-white"
        style={{ top: '30%' }}
        title="Trigger"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="events"
        className="!w-3 !h-3 !bg-teal-500 !border-2 !border-white"
        style={{ top: '70%' }}
        title="Events"
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
        </div>
        <p className="text-xs text-teal-600 mt-1">State-Space Model</p>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        {/* Rules Summary */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground/60">Rules:</span>
          {rulesConfigured ? (
            <span className="font-medium text-teal-700">
              {enabledRulesCount} active
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
              Not configured
            </span>
          )}
        </div>

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

        {/* Runtime Cost */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground/60">Runtime:</span>
          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
            $0 (rules-based)
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
        {nodeData.config.monitoring_description ? (
          <p className="text-xs text-teal-700 truncate" title={nodeData.config.monitoring_description}>
            {nodeData.config.monitoring_description}
          </p>
        ) : (
          <div className="flex items-center gap-2 text-teal-600">
            <span className="text-sm">🎓</span>
            <span className="text-xs">Click to configure in Node Inspector</span>
          </div>
        )}
      </div>

      {/* Output Handles - Severity Based */}
      <Handle
        type="source"
        position={Position.Right}
        id="info"
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
        style={{ top: '25%' }}
        title="Info Events (log only)"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="warning"
        className="!w-3 !h-3 !bg-amber-500 !border-2 !border-white"
        style={{ top: '50%' }}
        title="Warning Events (alert user)"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="critical"
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
        style={{ top: '75%' }}
        title="Critical Events (forward to AI Agent)"
      />
    </div>
  );
}
