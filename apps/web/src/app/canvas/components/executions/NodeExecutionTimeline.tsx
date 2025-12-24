'use client';

/**
 * NodeExecutionTimeline Component
 *
 * Displays the execution state of each node in the workflow.
 * Shows input/output data for each node with expandable details.
 */

import React, { useState } from 'react';
import type { NodeExecutionState } from '../../types';

interface NodeExecutionTimelineProps {
  nodeStates: Record<string, NodeExecutionState>;
}

// Status styling
const statusStyles: Record<string, { bg: string; text: string; icon: string }> = {
  pending: { bg: 'bg-slate-500', text: 'text-slate-400', icon: '○' },
  running: { bg: 'bg-blue-500', text: 'text-blue-400', icon: '⏳' },
  completed: { bg: 'bg-green-500', text: 'text-green-400', icon: '✓' },
  failed: { bg: 'bg-red-500', text: 'text-red-400', icon: '✗' },
  skipped: { bg: 'bg-slate-600', text: 'text-slate-500', icon: '⊘' },
};

export default function NodeExecutionTimeline({ nodeStates }: NodeExecutionTimelineProps) {
  const [expandedNode, setExpandedNode] = useState<string | null>(null);

  // Convert to array and sort by started_at
  const nodes = Object.entries(nodeStates || {})
    .map(([id, state]) => ({ id, ...state }))
    .sort((a, b) => {
      if (!a.started_at) return 1;
      if (!b.started_at) return -1;
      return new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
    });

  if (nodes.length === 0) {
    return (
      <p className="text-sm text-slate-500">No node execution data available</p>
    );
  }

  return (
    <div className="space-y-2">
      {nodes.map((node, index) => {
        const style = statusStyles[node.status] || statusStyles.pending;
        const isExpanded = expandedNode === node.id;

        // Calculate duration
        let duration = '';
        if (node.started_at && node.ended_at) {
          const ms = new Date(node.ended_at).getTime() - new Date(node.started_at).getTime();
          duration = `${(ms / 1000).toFixed(2)}s`;
        }

        return (
          <div key={node.id} className="relative">
            {/* Timeline connector */}
            {index < nodes.length - 1 && (
              <div className="absolute left-3 top-8 w-0.5 h-full bg-slate-700" />
            )}

            {/* Node Card */}
            <div className="relative">
              <button
                onClick={() => setExpandedNode(isExpanded ? null : node.id)}
                className="w-full flex items-start gap-3 p-2 rounded-lg hover:bg-slate-800 transition-colors text-left"
              >
                {/* Status Indicator */}
                <div
                  className={`
                    flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs
                    ${style.bg} text-white
                  `}
                >
                  {style.icon}
                </div>

                {/* Node Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-200 truncate">
                      {node.node_id.slice(0, 8)}...
                    </span>
                    <div className="flex items-center gap-2 text-xs">
                      {duration && <span className="text-slate-500">{duration}</span>}
                      <span className={`capitalize ${style.text}`}>{node.status}</span>
                    </div>
                  </div>

                  {/* Error preview */}
                  {node.error && (
                    <p className="text-xs text-red-400 truncate mt-0.5">{node.error}</p>
                  )}

                  {/* Input preview */}
                  {node.input && !isExpanded && (
                    <p className="text-xs text-slate-500 truncate mt-0.5">
                      Input: {typeof node.input === 'object' ? JSON.stringify(node.input).slice(0, 50) : String(node.input).slice(0, 50)}...
                    </p>
                  )}
                </div>

                {/* Expand indicator */}
                <svg
                  className={`h-4 w-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="ml-9 mt-2 space-y-3">
                  {/* Timestamps */}
                  <div className="text-xs text-slate-500">
                    {node.started_at && (
                      <p>Started: {new Date(node.started_at).toLocaleTimeString()}</p>
                    )}
                    {node.ended_at && (
                      <p>Ended: {new Date(node.ended_at).toLocaleTimeString()}</p>
                    )}
                  </div>

                  {/* Input */}
                  {node.input && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 mb-1">Input</h4>
                      <pre className="text-xs bg-slate-800 rounded p-2 overflow-x-auto text-slate-300">
                        {JSON.stringify(node.input, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Output */}
                  {node.output && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 mb-1">Output</h4>
                      <pre className="text-xs bg-slate-800 rounded p-2 overflow-x-auto text-slate-300">
                        {JSON.stringify(node.output, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* Error */}
                  {node.error && (
                    <div>
                      <h4 className="text-xs font-semibold text-red-400 mb-1">Error</h4>
                      <p className="text-xs text-red-300 bg-red-500/10 rounded p-2">
                        {node.error}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
