'use client';

/**
 * ExecutionsView Component
 *
 * Full-page view for displaying workflow execution history.
 * Shows a list of executions on the left and details on the right.
 */

import React from 'react';
import { useExecutionsOperations } from '../context/CanvasStateContext';
import ExecutionListItem from './executions/ExecutionListItem';
import ExecutionDetail from './executions/ExecutionDetail';

export default function ExecutionsView() {
  const { list, selected, select, refresh, loading, error, total } = useExecutionsOperations();

  return (
    <div className="flex h-full bg-slate-950">
      {/* Left Panel - Execution List */}
      <div className="w-1/3 min-w-[300px] max-w-[400px] border-r border-slate-800 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Executions</h2>
            <p className="text-xs text-slate-500">{total} total</p>
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <svg
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="m-4 rounded-lg border border-red-500/50 bg-red-500/10 p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        {/* Loading State */}
        {loading && list.length === 0 && (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-center">
              <div className="mb-2 h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
              <p className="text-sm text-slate-400">Loading executions...</p>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && list.length === 0 && !error && (
          <div className="flex flex-1 items-center justify-center p-8">
            <div className="text-center">
              <div className="mb-4 text-4xl">📋</div>
              <p className="text-sm text-slate-400">No executions yet</p>
              <p className="mt-1 text-xs text-slate-500">
                Trigger a workflow from the Chatbot to see executions here
              </p>
            </div>
          </div>
        )}

        {/* Execution List */}
        {list.length > 0 && (
          <div className="flex-1 overflow-y-auto">
            {list.map((execution) => (
              <ExecutionListItem
                key={execution.id}
                execution={execution}
                isSelected={selected?.id === execution.id}
                onClick={() => select(execution)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Right Panel - Execution Details */}
      <div className="flex-1 overflow-hidden">
        {selected ? (
          <ExecutionDetail execution={selected} onClose={() => select(null)} />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mb-4 text-4xl">👈</div>
              <p className="text-sm text-slate-400">Select an execution to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
