'use client';

/**
 * Create Canvas Modal
 *
 * Modal for creating a new canvas with options to:
 * - Choose mode (workflow, boardroom, hybrid)
 * - Start from scratch or use a template
 */

import React, { useState } from 'react';
import type { CreateCanvasInput, CanvasMode } from '../../types';

interface CreateCanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: CreateCanvasInput) => Promise<void>;
}

export default function CreateCanvasModal({
  isOpen,
  onClose,
  onCreate,
}: CreateCanvasModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [mode, setMode] = useState<CanvasMode>('workflow');
  const [creating, setCreating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      alert('Please enter a canvas name');
      return;
    }

    setCreating(true);

    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        mode,
      });

      // Reset form
      setName('');
      setDescription('');
      setMode('workflow');
    } catch (err) {
      console.error('[CreateCanvasModal] Error:', err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
          {/* Header */}
          <div className="border-b border-slate-800 px-6 py-5">
            <h2 className="text-xl font-bold text-slate-100">
              Create New Canvas
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Build visual workflows to orchestrate your AI features
            </p>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="px-6 py-6">
            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Canvas Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Research Workflow, Content Creation Pipeline"
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  autoFocus
                  disabled={creating}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-slate-300">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this canvas do?"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  disabled={creating}
                />
              </div>

              {/* Mode Selection */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Canvas Mode
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {/* Workflow */}
                  <button
                    type="button"
                    onClick={() => setMode('workflow')}
                    disabled={creating}
                    className={`rounded-lg border-2 p-4 text-left transition-all ${
                      mode === 'workflow'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                    } ${creating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="mb-2 text-2xl">⚙️</div>
                    <div className="text-sm font-medium text-slate-200">
                      Workflow
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      Automated execution
                    </div>
                  </button>

                  {/* Boardroom */}
                  <button
                    type="button"
                    onClick={() => setMode('boardroom')}
                    disabled={creating}
                    className={`rounded-lg border-2 p-4 text-left transition-all ${
                      mode === 'boardroom'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                    } ${creating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="mb-2 text-2xl">🏛️</div>
                    <div className="text-sm font-medium text-slate-200">
                      Boardroom
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      Multi-bot discussion
                    </div>
                  </button>

                  {/* Hybrid */}
                  <button
                    type="button"
                    onClick={() => setMode('hybrid')}
                    disabled={creating}
                    className={`rounded-lg border-2 p-4 text-left transition-all ${
                      mode === 'hybrid'
                        ? 'border-blue-500 bg-blue-500/10'
                        : 'border-slate-700 bg-slate-800 hover:border-slate-600'
                    } ${creating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="mb-2 text-2xl">🔀</div>
                    <div className="text-sm font-medium text-slate-200">
                      Hybrid
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      Mix of both
                    </div>
                  </button>
                </div>
              </div>

              {/* Mode Description */}
              <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-4">
                <p className="text-sm text-slate-300">
                  {mode === 'workflow' && (
                    <>
                      <strong>Workflow Mode:</strong> Build automated pipelines with
                      triggers, conditions, and sequential execution. Perfect for
                      research, content creation, and data processing.
                    </>
                  )}
                  {mode === 'boardroom' && (
                    <>
                      <strong>Boardroom Mode:</strong> Facilitate discussions between
                      multiple Genesis Bots. Great for brainstorming, debate,
                      consensus-building, and expert panels.
                    </>
                  )}
                  {mode === 'hybrid' && (
                    <>
                      <strong>Hybrid Mode:</strong> Combine automated workflows with
                      collaborative discussions. Use boardrooms within larger workflows
                      or add automation to discussions.
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={creating}
                className="rounded-lg border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {creating ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Creating...
                  </>
                ) : (
                  'Create Canvas'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
