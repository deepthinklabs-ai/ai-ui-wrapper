/**
 * Edit Employee Modal
 * Modal for editing an existing virtual employee's job title and role description
 */

'use client';

import React, { useState } from 'react';
import type { VirtualEmployee } from '../types';
import type { AIModel } from '@/lib/apiKeyStorage';
import { AVAILABLE_MODELS } from '@/lib/apiKeyStorage';
import ModelDropdown from '@/components/dashboard/ModelDropdown';

type EditEmployeeModalProps = {
  employee: VirtualEmployee;
  userTier?: 'free' | 'pro';
  onClose: () => void;
  onUpdate: (updates: { title: string; roleDescription: string; modelProvider: string; modelName: string }) => Promise<void>;
};

export default function EditEmployeeModal({ employee, userTier, onClose, onUpdate }: EditEmployeeModalProps) {
  const [title, setTitle] = useState(employee.title);
  const [roleDescription, setRoleDescription] = useState(employee.role_description);
  const [selectedModel, setSelectedModel] = useState<AIModel>(employee.model_name as AIModel);
  const [updating, setUpdating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !roleDescription.trim()) {
      return;
    }

    const modelInfo = AVAILABLE_MODELS.find(m => m.value === selectedModel);
    if (!modelInfo) return;

    setUpdating(true);
    try {
      await onUpdate({
        title: title.trim(),
        roleDescription: roleDescription.trim(),
        modelProvider: modelInfo.provider,
        modelName: selectedModel,
      });
      onClose();
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl relative overflow-visible">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-100">Edit {employee.name}</h2>
          <p className="mt-2 text-sm text-slate-400">
            Update job title and role description
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
              rows={6}
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
              disabled={updating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
              disabled={updating || !title.trim() || !roleDescription.trim()}
            >
              {updating ? 'Updating...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
