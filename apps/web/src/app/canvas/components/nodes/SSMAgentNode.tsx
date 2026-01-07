/**
 * SSMAgentNode Component
 *
 * Visual representation of an SSM (State-Space Model) node in the Canvas.
 * Displays model info, monitoring status, and provides access to configuration.
 *
 * Design notes:
 * - Teal color scheme to differentiate from other bot types
 * - Multiple output handles for different data types (alert, summary, classification)
 * - Status indicator showing monitoring state
 */

'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import type { SSMAgentNodeConfig } from '../../types/ssm';
import { SSM_MODEL_OPTIONS, MONITORING_TYPE_OPTIONS } from '../../features/ssm-agent/lib/ssmDefaults';

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
  const providerLabel = useMemo(() => {
    return SSM_MODEL_OPTIONS[nodeData.config.model_provider]?.label || 'Unknown';
  }, [nodeData.config.model_provider]);

  const monitoringInfo = useMemo(() => {
    return MONITORING_TYPE_OPTIONS.find(
      opt => opt.value === nodeData.config.monitoring_type
    );
  }, [nodeData.config.monitoring_type]);

  // Handle name editing
  const handleSaveName = useCallback(() => {
    // For now, just update local state
    // The actual save will happen through the config panel
    setIsEditing(false);
  }, []);

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
        {/* Model Info */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground/60">Model:</span>
          <span className="font-medium text-foreground/80 truncate max-w-[120px]" title={nodeData.config.model_name}>
            {nodeData.config.model_name}
          </span>
        </div>

        {/* Provider */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground/60">Provider:</span>
          <span className="text-xs px-2 py-0.5 bg-teal-100 text-teal-700 rounded-full">
            {providerLabel}
          </span>
        </div>

        {/* Monitoring Type */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground/60">Monitoring:</span>
          <span className="flex items-center gap-1">
            <span>{monitoringInfo?.icon}</span>
            <span className="text-foreground/80 text-xs truncate max-w-[100px]">
              {monitoringInfo?.label?.replace(' Detection', '')}
            </span>
          </span>
        </div>

        {/* Alert Threshold */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground/60">Threshold:</span>
          <span className="text-foreground/80">
            {((nodeData.config.alert_threshold || 0.7) * 100).toFixed(0)}%
          </span>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center justify-between text-sm pt-2 border-t border-foreground/10">
          <span className="text-foreground/60">Status:</span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-amber-600 text-xs">Standby</span>
          </span>
        </div>
      </div>

      {/* Footer - Event Source */}
      <div className="px-4 py-2 border-t border-teal-100 bg-teal-50/50 rounded-b-xl">
        <div className="flex items-center justify-between text-xs">
          <span className="text-foreground/50">Source:</span>
          <span className="text-teal-600 capitalize">
            {nodeData.config.event_source_type?.replace('_', ' ')}
          </span>
        </div>
      </div>

      {/* Output Handles */}
      <Handle
        type="source"
        position={Position.Right}
        id="alert"
        className="!w-3 !h-3 !bg-red-500 !border-2 !border-white"
        style={{ top: '25%' }}
        title="Alert Output"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="summary"
        className="!w-3 !h-3 !bg-blue-500 !border-2 !border-white"
        style={{ top: '50%' }}
        title="Summary Output"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="classification"
        className="!w-3 !h-3 !bg-purple-500 !border-2 !border-white"
        style={{ top: '75%' }}
        title="Classification Output"
      />
    </div>
  );
}
