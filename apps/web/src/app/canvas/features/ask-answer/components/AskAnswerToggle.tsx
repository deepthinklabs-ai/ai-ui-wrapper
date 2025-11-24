'use client';

/**
 * AskAnswerToggle Component
 *
 * Toggle switch to enable/disable Ask/Answer mode on an edge.
 * Used in edge inspector or edge label.
 */

import React, { useState } from 'react';
import type { AskAnswerToggleProps } from '../types';

export default function AskAnswerToggle({
  edgeId,
  fromNodeId,
  toNodeId,
  enabled,
  onToggle,
  disabled = false,
}: AskAnswerToggleProps) {
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    if (disabled || isToggling) return;

    setIsToggling(true);
    try {
      await onToggle(!enabled);
    } catch (error) {
      console.error('[AskAnswerToggle] Error toggling:', error);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-700 bg-slate-800 p-3">
      {/* Icon */}
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
        <span className="text-xl">💬</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-medium text-slate-200">Ask/Answer Mode</h4>
        <p className="text-xs text-slate-400 mt-0.5">
          Allow nodes to communicate with questions
        </p>
      </div>

      {/* Toggle Switch */}
      <button
        onClick={handleToggle}
        disabled={disabled || isToggling}
        className={`
          relative h-6 w-11 flex-shrink-0 rounded-full transition-colors
          ${enabled ? 'bg-purple-600' : 'bg-slate-600'}
          ${disabled || isToggling ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-500 cursor-pointer'}
        `}
        aria-label={enabled ? 'Disable Ask/Answer' : 'Enable Ask/Answer'}
      >
        {/* Toggle Circle */}
        <div
          className={`
            absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform
            ${enabled ? 'translate-x-5' : 'translate-x-0.5'}
          `}
        >
          {isToggling && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-purple-600 border-t-transparent" />
            </div>
          )}
        </div>
      </button>

      {/* Status Badge */}
      {enabled && !isToggling && (
        <div className="flex-shrink-0 rounded-full bg-purple-500/20 px-2 py-1 text-xs font-medium text-purple-300">
          Active
        </div>
      )}
    </div>
  );
}
