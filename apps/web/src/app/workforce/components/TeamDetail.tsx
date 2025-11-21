/**
 * Team Detail Component
 * Shows team information and employee grid
 */

'use client';

import React from 'react';
import type { Team, VirtualEmployee } from '../types';
import VirtualEmployeeCard from './VirtualEmployeeCard';

type TeamDetailProps = {
  team: Team;
  employees: VirtualEmployee[];
  loading: boolean;
  error: string | null;
  onHireEmployee: () => void;
  onStartTraining: (employee: VirtualEmployee) => void;
  onEditEmployee: (employee: VirtualEmployee) => void;
  onViewSystemPrompt: (employee: VirtualEmployee) => void;
  onUpdateEmployee: (id: string, updates: Partial<VirtualEmployee>) => Promise<boolean>;
  onDeleteEmployee: (id: string) => Promise<boolean>;
  refreshEmployees: () => Promise<void>;
};

export default function TeamDetail({
  team,
  employees,
  loading,
  error,
  onHireEmployee,
  onStartTraining,
  onEditEmployee,
  onViewSystemPrompt,
  onUpdateEmployee,
  onDeleteEmployee,
  refreshEmployees,
}: TeamDetailProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Team Header */}
      <div className="flex-shrink-0 border-b border-slate-800 bg-slate-900/30 p-6">
        <h2 className="text-2xl font-bold text-slate-100">{team.name}</h2>
        <div className="mt-3 rounded-lg border border-blue-700/30 bg-blue-900/10 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-blue-400">
            Team Mission
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            {team.mission_statement}
          </p>
        </div>
      </div>

      {/* Employees Section */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-200">
            Virtual Employees ({employees.length})
          </h3>
          <button
            onClick={onHireEmployee}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-500"
          >
            + Hire Employee
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-slate-400">Loading employees...</div>
          </div>
        ) : error ? (
          <div className="rounded-lg border border-red-700 bg-red-900/20 p-4">
            <div className="text-sm text-red-400">{error}</div>
          </div>
        ) : employees.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="text-6xl">👤</div>
            <p className="mt-4 text-sm font-medium text-slate-300">No employees yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Hire your first virtual employee to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {employees.map((employee) => (
              <VirtualEmployeeCard
                key={employee.id}
                employee={employee}
                onStartTraining={() => onStartTraining(employee)}
                onEdit={() => onEditEmployee(employee)}
                onViewSystemPrompt={() => onViewSystemPrompt(employee)}
                onDelete={() => onDeleteEmployee(employee.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
