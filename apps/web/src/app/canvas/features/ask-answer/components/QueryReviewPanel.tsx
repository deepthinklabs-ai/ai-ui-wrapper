'use client';

/**
 * QueryReviewPanel Component
 *
 * Displays the received answer from Node B for user review.
 * Allows user to copy answer, send follow-up question, or clear.
 */

import React, { useState } from 'react';
import type { QueryReviewPanelProps } from '../types';
import QueryInput from './QueryInput';

export default function QueryReviewPanel({
  pendingAnswer,
  onClear,
  onSendNewQuery,
}: QueryReviewPanelProps) {
  const [copied, setCopied] = useState(false);
  const [showFollowUp, setShowFollowUp] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pendingAnswer.answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('[QueryReviewPanel] Failed to copy:', error);
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const seconds = Math.floor(diff / 1000);

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="space-y-4 rounded-lg border border-purple-600/30 bg-purple-500/5 p-4">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-600/20">
            <span className="text-lg">💬</span>
          </div>
          <div>
            <h4 className="text-sm font-medium text-purple-300">Answer Received</h4>
            <p className="text-xs text-slate-400">
              From <span className="font-medium text-slate-300">{pendingAnswer.toNodeName}</span>{' '}
              • {formatTimestamp(pendingAnswer.timestamp)}
            </p>
          </div>
        </div>

        <button
          onClick={onClear}
          className="text-slate-400 hover:text-slate-200 transition-colors"
          aria-label="Clear answer"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Original Query */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-slate-400 uppercase">Your Question</div>
        <div className="rounded-md bg-slate-900 p-3 text-sm text-slate-300">
          {pendingAnswer.query}
        </div>
      </div>

      {/* Answer */}
      <div className="space-y-1">
        <div className="text-xs font-medium text-slate-400 uppercase">Answer</div>
        <div className="relative rounded-md bg-slate-900 p-3">
          <div className="pr-10 text-sm text-slate-200 whitespace-pre-wrap">
            {pendingAnswer.answer}
          </div>

          {/* Copy Button (floating) */}
          <button
            onClick={handleCopy}
            className={`
              absolute top-2 right-2 rounded-md p-1.5 transition-colors
              ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
              }
            `}
            aria-label="Copy answer"
          >
            {copied ? (
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            ) : (
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Actions */}
      {!showFollowUp ? (
        <div className="flex gap-2">
          <button
            onClick={() => setShowFollowUp(true)}
            className="flex-1 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition-colors"
          >
            Ask Follow-Up Question
          </button>
          <button
            onClick={onClear}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-xs font-medium text-slate-400 uppercase">Follow-Up Question</div>
          <QueryInput
            fromNodeId={pendingAnswer.fromNodeName} // Placeholder - actual ID passed from parent
            toNodeId={pendingAnswer.toNodeName} // Placeholder
            edgeId={pendingAnswer.queryId} // Placeholder
            onSendQuery={onSendNewQuery}
            placeholder="Ask a follow-up question..."
          />
          <button
            onClick={() => setShowFollowUp(false)}
            className="text-xs text-slate-400 hover:text-slate-300 underline"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
