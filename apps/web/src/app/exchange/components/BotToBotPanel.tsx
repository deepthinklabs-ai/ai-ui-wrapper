/**
 * BotToBotPanel Component
 *
 * Panel for sending bot-to-bot queries from the user's chatbot to a posted chatbot.
 * Supports single-query mode only (no multi-turn conversation).
 */

'use client';

import React, { useState } from 'react';

interface BotToBotPanelProps {
  targetPostId: string;
  targetTitle: string;
  targetProvider?: string;
  onSendQuery: (query: string, context?: string) => Promise<{
    success: boolean;
    response?: string;
    error?: string;
  }>;
  sending: boolean;
  error: string | null;
  lastResult: {
    success: boolean;
    response?: string;
    chatbot_name?: string;
    tokens_used?: number;
  } | null;
  remainingQueries: number | null;
  onClearError: () => void;
  onClearResult: () => void;
}

export default function BotToBotPanel({
  targetPostId,
  targetTitle,
  targetProvider,
  onSendQuery,
  sending,
  error,
  lastResult,
  remainingQueries,
  onClearError,
  onClearResult,
}: BotToBotPanelProps) {
  const [query, setQuery] = useState('');
  const [context, setContext] = useState('');
  const [showContext, setShowContext] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || sending) return;

    onClearError();
    onClearResult();

    await onSendQuery(query.trim(), showContext ? context.trim() : undefined);
  };

  const getProviderIcon = (provider?: string) => {
    switch (provider) {
      case 'openai':
        return '🤖';
      case 'claude':
        return '🟣';
      case 'grok':
        return '⚡';
      case 'gemini':
        return '🔷';
      default:
        return '🤖';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{getProviderIcon(targetProvider)}</span>
          <div>
            <h3 className="text-sm font-medium text-slate-100">
              Query {targetTitle}
            </h3>
            <p className="text-xs text-slate-400">
              Single-query mode (no conversation)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-blue-500/20 px-2 py-1 text-xs font-medium text-blue-300">
            Bot-to-Bot
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Remaining Queries */}
        {remainingQueries !== null && (
          <div className="rounded-lg bg-slate-700/50 px-4 py-2">
            <p className="text-sm text-slate-300">
              <span className="font-medium">{remainingQueries}</span> queries remaining today
            </p>
          </div>
        )}

        {/* Result Display */}
        {lastResult?.success && lastResult.response && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-green-400">Response from {lastResult.chatbot_name}</span>
              </div>
              <button
                onClick={onClearResult}
                className="text-green-400 hover:text-green-300"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-sm text-green-100 whitespace-pre-wrap">
              {lastResult.response}
            </div>
            {lastResult.tokens_used !== undefined && (
              <p className="mt-2 text-xs text-green-400">
                {lastResult.tokens_used} tokens used
              </p>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 px-4 py-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-300">{error}</p>
              <button
                onClick={onClearError}
                className="text-red-400 hover:text-red-300"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* How it works */}
        {!lastResult && !error && (
          <div className="rounded-lg bg-slate-700/30 p-4">
            <h4 className="text-sm font-medium text-slate-300 mb-2">How Bot-to-Bot Works</h4>
            <ul className="text-xs text-slate-400 space-y-1">
              <li>• Send a single query to this chatbot</li>
              <li>• Uses YOUR API key (not the poster's)</li>
              <li>• Optionally include context from your conversation</li>
              <li>• Limited to 10 queries per day</li>
              <li>• No multi-turn conversation support</li>
            </ul>
          </div>
        )}
      </div>

      {/* Query Form */}
      <form onSubmit={handleSubmit} className="border-t border-slate-700 p-4 space-y-4">
        {/* Context Toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowContext(!showContext)}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              showContext
                ? 'bg-purple-500/20 text-purple-300'
                : 'bg-slate-700 text-slate-400 hover:text-slate-300'
            }`}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            {showContext ? 'Hide Context' : 'Add Context'}
          </button>
          <span className="text-xs text-slate-500">
            Optional context from your conversation
          </span>
        </div>

        {/* Context Input */}
        {showContext && (
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Paste relevant context from your conversation..."
            rows={3}
            className="w-full resize-none rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-100 placeholder-slate-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
          />
        )}

        {/* Query Input */}
        <div className="flex gap-2">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type your query..."
            disabled={sending}
            rows={2}
            className="flex-1 resize-none rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm text-slate-100 placeholder-slate-400 focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!query.trim() || sending}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors self-end"
          >
            {sending ? (
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>Querying...</span>
              </div>
            ) : (
              'Send Query'
            )}
          </button>
        </div>

        <p className="text-xs text-slate-500">
          This sends a one-time query. For interactive testing, use the Test tab.
        </p>
      </form>
    </div>
  );
}
