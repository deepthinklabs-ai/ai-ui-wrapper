/**
 * Context Window Indicator Component
 *
 * Displays a visual indicator of how much of the model's context window
 * is currently filled. Helps users understand when they need to summarize
 * or start a new thread.
 */

"use client";

import React from "react";
import { formatTokenCount, getUsageColor, getUsageBackgroundColor } from "@/lib/tokenCounter";

type ContextWindowIndicatorProps = {
  totalTokens: number;
  maxTokens: number;
  percentage: number;
  isNearLimit: boolean;
  isAtLimit: boolean;
  shouldSummarize: boolean;
  modelLabel: string;
};

const ContextWindowIndicator: React.FC<ContextWindowIndicatorProps> = ({
  totalTokens,
  maxTokens,
  percentage,
  isNearLimit,
  isAtLimit,
  shouldSummarize,
  modelLabel,
}) => {
  const colorClass = getUsageColor(percentage);
  const bgColorClass = getUsageBackgroundColor(percentage);

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <svg
            className={`h-4 w-4 ${colorClass}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <span className="text-xs font-medium text-slate-300">Context Window</span>
        </div>
        <span className={`text-xs font-bold ${colorClass}`}>
          {percentage.toFixed(1)}%
        </span>
      </div>

      {/* Progress Bar */}
      <div className="mb-2 h-2 w-full rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full transition-all duration-300 ${bgColorClass}`}
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>

      {/* Token Count */}
      <div className="flex items-center justify-between text-[10px] text-slate-500">
        <span>
          {formatTokenCount(totalTokens)} / {formatTokenCount(maxTokens)} tokens
        </span>
        <span className="text-slate-600">{modelLabel}</span>
      </div>

      {/* Warning Messages */}
      {isAtLimit && (
        <div className="mt-2 rounded-md border border-red-600 bg-red-600/10 px-2 py-1.5 text-[10px] text-red-400">
          🛑 CRITICAL: Context window at limit! Use "Summarize & Continue" NOW to avoid errors and hallucinations.
        </div>
      )}
      {shouldSummarize && !isAtLimit && (
        <div className="mt-2 rounded-md border border-orange-600 bg-orange-600/10 px-2 py-1.5 text-[10px] text-orange-400">
          ⚠️ WARNING: Context filling up fast. Strongly recommend "Summarize & Continue" to start a new thread.
        </div>
      )}
      {isNearLimit && !shouldSummarize && (
        <div className="mt-2 rounded-md border border-yellow-600 bg-yellow-600/10 px-2 py-1.5 text-[10px] text-yellow-400">
          📊 Context window filling up. Consider summarizing soon to maintain quality.
        </div>
      )}
    </div>
  );
};

export default ContextWindowIndicator;
