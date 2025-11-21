/**
 * View System Prompt Modal
 * Displays the employee's current system prompt
 */

'use client';

import React from 'react';
import type { VirtualEmployee } from '../types';

type ViewSystemPromptModalProps = {
  employee: VirtualEmployee;
  onClose: () => void;
};

export default function ViewSystemPromptModal({ employee, onClose }: ViewSystemPromptModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-slate-700 bg-slate-900 shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-slate-800 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-100">
                System Prompt: {employee.name}
              </h2>
              <p className="mt-1 text-sm text-slate-400">{employee.title}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>

        {/* System Prompt Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Current System Prompt
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(employee.system_prompt);
                  alert('System prompt copied to clipboard!');
                }}
                className="rounded px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Copy
              </button>
            </div>
            <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200 font-mono">
              {employee.system_prompt}
            </div>
          </div>

          {/* Metadata */}
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                AI Model
              </div>
              <div className="mt-2 text-sm text-slate-200">
                {employee.model_provider} / {employee.model_name}
              </div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Status
              </div>
              <div className="mt-2 text-sm text-slate-200 capitalize">
                {employee.status}
              </div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Created
              </div>
              <div className="mt-2 text-sm text-slate-200">
                {new Date(employee.created_at).toLocaleDateString()} at{' '}
                {new Date(employee.created_at).toLocaleTimeString()}
              </div>
            </div>
            <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Last Updated
              </div>
              <div className="mt-2 text-sm text-slate-200">
                {new Date(employee.updated_at).toLocaleDateString()} at{' '}
                {new Date(employee.updated_at).toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
