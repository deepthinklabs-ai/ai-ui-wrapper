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
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="relative w-full max-w-lg rounded-2xl border border-white/40 bg-white/80 backdrop-blur-md shadow-2xl">
          {/* Header */}
          <div className="border-b border-white/40 px-6 py-5">
            <h2 className="text-xl font-bold text-foreground">
              Create New Canvas
            </h2>
            <p className="mt-1 text-sm text-foreground/60">
              Build visual workflows to orchestrate your AI features
            </p>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="px-6 py-6">
            <div className="space-y-5">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Canvas Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Research Workflow, Content Creation Pipeline"
                  className="mt-1 w-full rounded-lg border border-foreground/20 bg-white/80 px-4 py-2 text-foreground placeholder-foreground/40 focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/50"
                  autoFocus
                  disabled={creating}
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-foreground">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What does this canvas do?"
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-foreground/20 bg-white/80 px-4 py-2 text-foreground placeholder-foreground/40 focus:border-sky focus:outline-none focus:ring-2 focus:ring-sky/50"
                  disabled={creating}
                />
              </div>

              {/* Mode Selection - Currently only Workflow mode is available */}
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Canvas Mode
                </label>
                <div className="grid grid-cols-1 gap-3">
                  {/* Workflow */}
                  <button
                    type="button"
                    onClick={() => setMode('workflow')}
                    disabled={creating}
                    className={`rounded-lg border-2 p-4 text-left transition-all ${
                      mode === 'workflow'
                        ? 'border-sky bg-sky/10'
                        : 'border-white/40 bg-white/60 hover:border-foreground/30'
                    } ${creating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="mb-2 text-2xl">⚙️</div>
                    <div className="text-sm font-medium text-foreground">
                      Workflow
                    </div>
                    <div className="mt-1 text-xs text-foreground/60">
                      Automated execution
                    </div>
                  </button>

                  {/* Boardroom - Hidden until implemented */}
                  {/* Hybrid - Hidden until implemented */}
                </div>
              </div>

              {/* Mode Description */}
              <div className="rounded-lg border border-white/40 bg-white/60 p-4">
                <p className="text-sm text-foreground/60">
                  <strong className="text-foreground">Workflow Mode:</strong> Build automated pipelines with
                  triggers, conditions, and sequential execution. Perfect for
                  research, content creation, and data processing.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-6 flex gap-3 justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={creating}
                className="rounded-lg border border-foreground/30 bg-white/60 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="rounded-lg bg-sky px-4 py-2 text-sm font-medium text-white hover:bg-sky/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
