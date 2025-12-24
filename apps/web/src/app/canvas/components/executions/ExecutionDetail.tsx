'use client';

/**
 * ExecutionDetail Component
 *
 * Displays detailed information about a single workflow execution.
 * Shows input, node execution timeline, and final output.
 */

import React, { useState } from 'react';
import type { WorkflowExecution } from '../../types';
import NodeExecutionTimeline from './NodeExecutionTimeline';

interface ExecutionDetailProps {
  execution: WorkflowExecution;
  onClose: () => void;
}

// Status badge styling
const statusStyles: Record<string, string> = {
  running: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  completed: 'bg-green-500/20 text-green-400 border-green-500/50',
  failed: 'bg-red-500/20 text-red-400 border-red-500/50',
  paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  idle: 'bg-slate-500/20 text-slate-400 border-slate-500/50',
};

export default function ExecutionDetail({ execution, onClose }: ExecutionDetailProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('nodes');

  // Format timestamps
  const startedAt = new Date(execution.started_at);
  const endedAt = execution.ended_at ? new Date(execution.ended_at) : null;
  const durationMs = endedAt
    ? endedAt.getTime() - startedAt.getTime()
    : Date.now() - startedAt.getTime();

  // Get final output
  const finalOutput = execution.final_output;
  const response = finalOutput?.response || '';

  // Toggle section
  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-lg font-semibold text-slate-100">Execution Details</h2>
            <span
              className={`
                inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border
                ${statusStyles[execution.status] || statusStyles.idle}
              `}
            >
              {execution.status}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            {startedAt.toLocaleString()} • {(durationMs / 1000).toFixed(2)}s
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Error Banner */}
        {execution.error && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4">
            <h3 className="text-sm font-semibold text-red-400 mb-1">Error</h3>
            <p className="text-sm text-red-300">{execution.error}</p>
          </div>
        )}

        {/* Node Execution Timeline */}
        <div className="rounded-lg border border-slate-700 bg-slate-900">
          <button
            onClick={() => toggleSection('nodes')}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <h3 className="text-sm font-semibold text-slate-200">Node Execution Timeline</h3>
            <svg
              className={`h-4 w-4 text-slate-400 transition-transform ${expandedSection === 'nodes' ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSection === 'nodes' && (
            <div className="border-t border-slate-700 p-4">
              <NodeExecutionTimeline nodeStates={execution.node_states} />
            </div>
          )}
        </div>

        {/* Execution Log */}
        <div className="rounded-lg border border-slate-700 bg-slate-900">
          <button
            onClick={() => toggleSection('log')}
            className="w-full flex items-center justify-between p-4 text-left"
          >
            <h3 className="text-sm font-semibold text-slate-200">
              Execution Log ({execution.execution_log?.length || 0} entries)
            </h3>
            <svg
              className={`h-4 w-4 text-slate-400 transition-transform ${expandedSection === 'log' ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {expandedSection === 'log' && (
            <div className="border-t border-slate-700 max-h-96 overflow-y-auto">
              {execution.execution_log && execution.execution_log.length > 0 ? (
                <div className="divide-y divide-slate-800">
                  {execution.execution_log.map((entry, idx) => (
                    <div key={idx} className="p-3 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            entry.level === 'error' ? 'bg-red-500' :
                            entry.level === 'warn' ? 'bg-yellow-500' : 'bg-blue-500'
                          }`}
                        />
                        <span className="text-xs text-slate-500">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                        {entry.node_id && (
                          <span className="text-xs text-slate-600">
                            [{entry.node_id.slice(0, 8)}...]
                          </span>
                        )}
                      </div>
                      <p className="text-slate-300">{entry.message}</p>
                      {entry.data && (
                        <pre className="mt-1 text-xs text-slate-500 overflow-x-auto">
                          {JSON.stringify(entry.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="p-4 text-sm text-slate-500">No log entries</p>
              )}
            </div>
          )}
        </div>

        {/* Final Output */}
        {response && (
          <div className="rounded-lg border border-slate-700 bg-slate-900">
            <button
              onClick={() => toggleSection('output')}
              className="w-full flex items-center justify-between p-4 text-left"
            >
              <h3 className="text-sm font-semibold text-slate-200">Final Response</h3>
              <svg
                className={`h-4 w-4 text-slate-400 transition-transform ${expandedSection === 'output' ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {expandedSection === 'output' && (
              <div className="border-t border-slate-700 p-4">
                <div className="rounded-md bg-slate-800 p-3 text-sm text-slate-300 whitespace-pre-wrap">
                  {response}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Execution ID */}
        <div className="text-xs text-slate-600">
          Execution ID: {execution.id}
        </div>
      </div>
    </div>
  );
}
