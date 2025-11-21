/**
 * Team List Component
 * Displays a list of teams for selection
 */

'use client';

import React from 'react';
import type { Team } from '../types';

type TeamListProps = {
  teams: Team[];
  selectedTeam: Team | null;
  onSelectTeam: (team: Team) => void;
  loading: boolean;
  error: string | null;
};

export default function TeamList({
  teams,
  selectedTeam,
  onSelectTeam,
  loading,
  error,
}: TeamListProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-sm text-slate-400">Loading teams...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="m-4 rounded-lg border border-red-700 bg-red-900/20 p-4">
        <div className="text-sm text-red-400">{error}</div>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <div className="text-4xl">👥</div>
        <div className="mt-4 text-center">
          <p className="text-sm font-medium text-slate-300">No teams yet</p>
          <p className="mt-1 text-xs text-slate-500">
            Create your first team to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4">
      {teams.map((team) => {
        const isSelected = selectedTeam?.id === team.id;

        return (
          <button
            key={team.id}
            onClick={() => onSelectTeam(team)}
            className={`w-full rounded-lg border p-3 text-left transition-all ${
              isSelected
                ? 'border-blue-500 bg-blue-500/10'
                : 'border-slate-700 bg-slate-800/50 hover:border-slate-600 hover:bg-slate-800'
            }`}
          >
            <div className="font-medium text-slate-200">{team.name}</div>
            <div className="mt-1 line-clamp-2 text-xs text-slate-400">
              {team.mission_statement}
            </div>
          </button>
        );
      })}
    </div>
  );
}
