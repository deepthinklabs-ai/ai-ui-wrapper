/**
 * Hire Employee Modal
 * Modal for hiring a new virtual employee
 */

'use client';

import React, { useState } from 'react';
import type { Team, CreateEmployeeInput } from '../types';
import type { AIModel } from '@/lib/apiKeyStorage';
import { AVAILABLE_MODELS } from '@/lib/apiKeyStorage';
import ModelDropdown from '@/components/dashboard/ModelDropdown';

type HireEmployeeModalProps = {
  team: Team;
  onClose: () => void;
  onHire: (input: CreateEmployeeInput) => Promise<void>;
  userTier?: 'free' | 'pro';
};

export default function HireEmployeeModal({ team, onClose, onHire, userTier }: HireEmployeeModalProps) {
  const [title, setTitle] = useState('');
  const [roleDescription, setRoleDescription] = useState('');
  const [selectedModel, setSelectedModel] = useState<AIModel>('gpt-4o');
  const [hiring, setHiring] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !roleDescription.trim()) {
      return;
    }

    const modelInfo = AVAILABLE_MODELS.find(m => m.value === selectedModel);
    if (!modelInfo) return;

    setHiring(true);
    try {
      await onHire({
        teamId: team.id,
        title: title.trim(),
        roleDescription: roleDescription.trim(),
        modelProvider: modelInfo.provider,
        modelName: selectedModel,
      });
    } finally {
      setHiring(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => {
        // Only close if clicking the backdrop itself, not the modal content
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl relative overflow-visible"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-100">Hire Virtual Employee</h2>
          <p className="mt-2 text-sm text-slate-400">
            A random name and voice will be assigned automatically
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 overflow-visible">
          <div>
            <label className="block text-sm font-medium text-slate-300">Job Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Head of Content Creation"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300">
              Role Description
            </label>
            <textarea
              value={roleDescription}
              onChange={(e) => setRoleDescription(e.target.value)}
              placeholder="Describe this employee's responsibilities and what they should do..."
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">AI Model</label>
            <ModelDropdown
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              userTier={userTier}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 px-4 py-2 font-medium text-slate-300 transition-colors hover:bg-slate-800"
              disabled={hiring}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-green-600 px-4 py-2 font-medium text-white transition-colors hover:bg-green-500 disabled:opacity-50"
              disabled={hiring || !title.trim() || !roleDescription.trim()}
            >
              {hiring ? 'Hiring...' : 'Hire Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
