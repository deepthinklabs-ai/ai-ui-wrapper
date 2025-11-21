/**
 * Create Team Modal
 * Modal for creating a new team
 */

'use client';

import React, { useState } from 'react';
import type { CreateTeamInput } from '../types';

type CreateTeamModalProps = {
  onClose: () => void;
  onCreate: (input: CreateTeamInput) => Promise<void>;
};

export default function CreateTeamModal({ onClose, onCreate }: CreateTeamModalProps) {
  const [name, setName] = useState('');
  const [missionStatement, setMissionStatement] = useState('');
  const [creating, setCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !missionStatement.trim()) {
      return;
    }

    setCreating(true);
    try {
      await onCreate({ name: name.trim(), missionStatement: missionStatement.trim() });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-100">Create New Team</h2>
          <p className="mt-2 text-sm text-slate-400">
            Define your team's mission and start hiring virtual employees
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Team Name */}
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Team Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Twitter Growth Team"
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              required
            />
          </div>

          {/* Mission Statement */}
          <div>
            <label className="block text-sm font-medium text-slate-300">
              Mission Statement / Goal
            </label>
            <textarea
              value={missionStatement}
              onChange={(e) => setMissionStatement(e.target.value)}
              placeholder="e.g. Completely run a Twitter account to gain the most traction possible and earn as much money as possible"
              rows={4}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              This guides all virtual employees on what to accomplish
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-700 px-4 py-2 font-medium text-slate-300 transition-colors hover:bg-slate-800"
              disabled={creating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
              disabled={creating || !name.trim() || !missionStatement.trim()}
            >
              {creating ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
