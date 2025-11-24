'use client';

/**
 * QueryInput Component
 *
 * Input field for Node A to send questions to Node B.
 * Shows in Genesis Bot node inspector when Ask/Answer is enabled.
 */

import React, { useState } from 'react';
import type { QueryInputProps } from '../types';
import { ASK_ANSWER_CONSTANTS } from '../types';

export default function QueryInput({
  fromNodeId,
  toNodeId,
  edgeId,
  onSendQuery,
  disabled = false,
  placeholder = 'Ask a question...',
}: QueryInputProps) {
  const [query, setQuery] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remainingChars = ASK_ANSWER_CONSTANTS.MAX_QUERY_LENGTH - query.length;
  const isOverLimit = query.length > ASK_ANSWER_CONSTANTS.MAX_QUERY_LENGTH;
  const isEmpty = query.trim().length === 0;

  const handleSend = async () => {
    if (disabled || isSending || isEmpty || isOverLimit) return;

    setIsSending(true);
    setError(null);

    try {
      await onSendQuery(query);
      setQuery(''); // Clear input after successful send
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send query');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Ctrl/Cmd + Enter
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-300">Ask Question</label>
        <div className={`text-xs ${isOverLimit ? 'text-red-400' : 'text-slate-500'}`}>
          {remainingChars} chars remaining
        </div>
      </div>

      {/* Input Area */}
      <div className="relative">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isSending}
          placeholder={placeholder}
          className={`
            w-full rounded-lg border bg-slate-900 px-3 py-2 text-sm text-slate-200
            placeholder-slate-500 resize-none transition-colors
            ${isOverLimit ? 'border-red-500/50 focus:border-red-500' : 'border-slate-700 focus:border-purple-500'}
            ${disabled || isSending ? 'opacity-50 cursor-not-allowed' : ''}
            focus:outline-none focus:ring-2 focus:ring-purple-500/20
          `}
          rows={3}
        />

        {/* Loading Overlay */}
        {isSending && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-slate-900/80 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
              <span className="text-sm text-slate-300">Sending query...</span>
            </div>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="rounded-md bg-red-500/10 border border-red-500/50 px-3 py-2 text-xs text-red-300">
          <div className="flex items-center gap-2">
            <span>❌</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">
          Press <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">Ctrl</kbd> +{' '}
          <kbd className="rounded bg-slate-800 px-1.5 py-0.5 text-slate-400">Enter</kbd> to send
        </div>

        <button
          onClick={handleSend}
          disabled={disabled || isSending || isEmpty || isOverLimit}
          className={`
            rounded-lg px-4 py-2 text-sm font-medium transition-colors
            ${
              disabled || isSending || isEmpty || isOverLimit
                ? 'bg-slate-700 text-slate-500 cursor-not-allowed'
                : 'bg-purple-600 text-white hover:bg-purple-500'
            }
          `}
        >
          {isSending ? 'Sending...' : 'Send Question'}
        </button>
      </div>
    </div>
  );
}
