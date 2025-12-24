'use client';

/**
 * ExecutionListItem Component
 *
 * Displays a single execution in the list with status, timestamp, and duration.
 */

import React from 'react';
import type { WorkflowExecution } from '../../types';

interface ExecutionListItemProps {
  execution: WorkflowExecution;
  isSelected: boolean;
  onClick: () => void;
}

// Status badge styling
const statusStyles: Record<string, string> = {
  running: 'bg-blue-500/20 text-blue-400 border-blue-500/50',
  completed: 'bg-green-500/20 text-green-400 border-green-500/50',
  failed: 'bg-red-500/20 text-red-400 border-red-500/50',
  paused: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
  idle: 'bg-slate-500/20 text-slate-400 border-slate-500/50',
};

const statusIcons: Record<string, string> = {
  running: '⏳',
  completed: '✓',
  failed: '✗',
  paused: '⏸',
  idle: '○',
};

export default function ExecutionListItem({ execution, isSelected, onClick }: ExecutionListItemProps) {
  // Format timestamp
  const startedAt = new Date(execution.started_at);
  const formattedDate = startedAt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  // Calculate duration
  const durationMs = execution.ended_at
    ? new Date(execution.ended_at).getTime() - startedAt.getTime()
    : Date.now() - startedAt.getTime();
  const durationSec = (durationMs / 1000).toFixed(1);

  // Get input message preview from execution log or final output
  const inputMessage = execution.execution_log?.[0]?.message || 'No message';
  const messagePreview = inputMessage.length > 80 ? inputMessage.slice(0, 80) + '...' : inputMessage;

  return (
    <button
      onClick={onClick}
      className={`
        w-full p-4 text-left border-b border-slate-800 transition-colors
        ${isSelected ? 'bg-slate-800' : 'hover:bg-slate-900'}
      `}
    >
      {/* Header Row */}
      <div className="flex items-center justify-between mb-2">
        {/* Status Badge */}
        <span
          className={`
            inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border
            ${statusStyles[execution.status] || statusStyles.idle}
          `}
        >
          <span>{statusIcons[execution.status] || '○'}</span>
          <span className="capitalize">{execution.status}</span>
        </span>

        {/* Duration */}
        <span className="text-xs text-slate-500">{durationSec}s</span>
      </div>

      {/* Message Preview */}
      <p className="text-sm text-slate-300 mb-1 line-clamp-2">{messagePreview}</p>

      {/* Timestamp */}
      <p className="text-xs text-slate-500">{formattedDate}</p>

      {/* Error indicator */}
      {execution.error && (
        <p className="mt-1 text-xs text-red-400 truncate">
          Error: {execution.error}
        </p>
      )}
    </button>
  );
}
