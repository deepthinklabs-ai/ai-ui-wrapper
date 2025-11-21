/**
 * Workforce Page
 * Main page for managing Virtual Employee teams
 */

'use client';

import React, { useState } from 'react';
import { redirect } from 'next/navigation';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useUserTier } from '@/hooks/useUserTier';
import { useTeams } from './hooks/useTeams';
import { useVirtualEmployees } from './hooks/useVirtualEmployees';
import TeamList from './components/TeamList';
import TeamDetail from './components/TeamDetail';
import CreateTeamModal from './components/CreateTeamModal';
import HireEmployeeModal from './components/HireEmployeeModal';
import EditEmployeeModal from './components/EditEmployeeModal';
import ViewSystemPromptModal from './components/ViewSystemPromptModal';
import TrainingSessionPanel from './components/TrainingSessionPanel';
import type { VirtualEmployee } from './types';

export default function WorkforcePage() {
  const { user, loadingUser } = useAuthSession();
  const { tier } = useUserTier(user?.id);

  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showHireEmployee, setShowHireEmployee] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<VirtualEmployee | null>(null);
  const [viewingPromptEmployee, setViewingPromptEmployee] = useState<VirtualEmployee | null>(null);
  const [trainingEmployee, setTrainingEmployee] = useState<VirtualEmployee | null>(null);

  // Teams management
  const {
    teams,
    loading: teamsLoading,
    error: teamsError,
    selectedTeam,
    createTeam,
    selectTeam,
    refreshTeams,
  } = useTeams(user?.id);

  // Employees management
  const {
    employees,
    loading: employeesLoading,
    error: employeesError,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    refreshEmployees,
  } = useVirtualEmployees(selectedTeam?.id || null);

  // Auth redirect
  if (!loadingUser && !user) {
    redirect('/auth');
  }

  if (loadingUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="text-slate-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200">
      {/* Sidebar: Team List */}
      <div className="w-80 flex-shrink-0 border-r border-slate-800 bg-slate-900/50">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex-shrink-0 border-b border-slate-800 p-4">
            <h1 className="text-xl font-bold text-slate-100">The Workforce</h1>
            <p className="mt-1 text-sm text-slate-400">
              Virtual employees working together
            </p>
          </div>

          {/* Team List */}
          <div className="flex-1 overflow-y-auto">
            <TeamList
              teams={teams}
              selectedTeam={selectedTeam}
              onSelectTeam={selectTeam}
              loading={teamsLoading}
              error={teamsError}
            />
          </div>

          {/* Create Team Button */}
          <div className="flex-shrink-0 border-t border-slate-800 p-4">
            <button
              onClick={() => setShowCreateTeam(true)}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
            >
              + Create New Team
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        {selectedTeam ? (
          <TeamDetail
            team={selectedTeam}
            employees={employees}
            loading={employeesLoading}
            error={employeesError}
            onHireEmployee={() => setShowHireEmployee(true)}
            onStartTraining={(employee) => setTrainingEmployee(employee)}
            onEditEmployee={(employee) => setEditingEmployee(employee)}
            onViewSystemPrompt={(employee) => setViewingPromptEmployee(employee)}
            onUpdateEmployee={updateEmployee}
            onDeleteEmployee={deleteEmployee}
            refreshEmployees={refreshEmployees}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="text-6xl">👥</div>
              <h2 className="mt-4 text-xl font-semibold text-slate-300">
                No Team Selected
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                Create a team to get started with virtual employees
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCreateTeam && (
        <CreateTeamModal
          onClose={() => setShowCreateTeam(false)}
          onCreate={async (input) => {
            const team = await createTeam(input);
            if (team) {
              setShowCreateTeam(false);
              await refreshTeams();
            }
          }}
        />
      )}

      {showHireEmployee && selectedTeam && (
        <HireEmployeeModal
          team={selectedTeam}
          userTier={tier}
          onClose={() => setShowHireEmployee(false)}
          onHire={async (input) => {
            const employee = await createEmployee(input, selectedTeam);
            if (employee) {
              setShowHireEmployee(false);
              await refreshEmployees();
            }
          }}
        />
      )}

      {/* Edit Employee Modal */}
      {editingEmployee && (
        <EditEmployeeModal
          employee={editingEmployee}
          userTier={tier}
          onClose={() => setEditingEmployee(null)}
          onUpdate={async (updates) => {
            const success = await updateEmployee(editingEmployee.id, {
              title: updates.title,
              role_description: updates.roleDescription,
              model_provider: updates.modelProvider as any,
              model_name: updates.modelName,
            });
            if (success) {
              setEditingEmployee(null);
              await refreshEmployees();
            }
          }}
        />
      )}

      {/* View System Prompt Modal */}
      {viewingPromptEmployee && (
        <ViewSystemPromptModal
          employee={viewingPromptEmployee}
          onClose={() => setViewingPromptEmployee(null)}
        />
      )}

      {/* Training Session Panel */}
      {trainingEmployee && selectedTeam && (
        <TrainingSessionPanel
          employee={trainingEmployee}
          team={selectedTeam}
          allEmployees={employees}
          userId={user?.id || ''}
          userTier={tier}
          onClose={() => setTrainingEmployee(null)}
        />
      )}
    </div>
  );
}
