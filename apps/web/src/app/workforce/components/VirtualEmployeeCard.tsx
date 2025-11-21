/**
 * Virtual Employee Card
 * Display card for a single virtual employee
 */

'use client';

import React from 'react';
import type { VirtualEmployee } from '../types';

type VirtualEmployeeCardProps = {
  employee: VirtualEmployee;
  onStartTraining: () => void;
  onEdit: () => void;
  onViewSystemPrompt: () => void;
  onDelete: () => void;
};

export default function VirtualEmployeeCard({
  employee,
  onStartTraining,
  onEdit,
  onViewSystemPrompt,
  onDelete,
}: VirtualEmployeeCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'idle':
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
      case 'training':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'working':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'waiting':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getGenderEmoji = (gender: string) => {
    switch (gender) {
      case 'male':
        return '👨';
      case 'female':
        return '👩';
      case 'nonbinary':
        return '🧑';
      default:
        return '👤';
    }
  };

  return (
    <div className="flex flex-col rounded-xl border border-slate-700 bg-slate-800/50 p-5 transition-all hover:border-slate-600">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="text-3xl">{getGenderEmoji(employee.gender)}</div>
          <div>
            <h4 className="font-semibold text-slate-100">{employee.name}</h4>
            <p className="text-xs text-slate-400">{employee.title}</p>
          </div>
        </div>
        <div
          className={`rounded-full border px-2 py-1 text-xs font-medium ${getStatusColor(
            employee.status
          )}`}
        >
          {employee.status}
        </div>
      </div>

      {/* Role Description */}
      <p className="mt-4 line-clamp-3 text-sm text-slate-300">
        {employee.role_description}
      </p>

      {/* Model Info */}
      <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
        <span className="rounded bg-slate-700/50 px-2 py-1">
          {employee.model_provider}
        </span>
        <span className="rounded bg-slate-700/50 px-2 py-1">
          {employee.model_name}
        </span>
      </div>

      {/* Actions */}
      <div className="mt-5 space-y-2">
        <div className="flex gap-2">
          <button
            onClick={onStartTraining}
            className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-500"
          >
            Training
          </button>
          <button
            onClick={onEdit}
            className="flex-1 rounded-lg border border-slate-600 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700"
          >
            Edit
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onViewSystemPrompt}
            className="flex-1 rounded-lg border border-purple-600 px-3 py-2 text-xs font-medium text-purple-400 transition-colors hover:bg-purple-900/20"
          >
            View Prompt
          </button>
          <button
            onClick={onDelete}
            className="flex-1 rounded-lg border border-red-700 px-3 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-900/20"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
