/**
 * useVirtualEmployees Hook
 * Manages CRUD operations for Virtual Employees
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { VirtualEmployee, CreateEmployeeInput } from '../types';
import { generateVirtualEmployeeIdentity } from '../lib/generateVirtualEmployeeIdentity';
import { composeEmployeeSystemPrompt } from '../lib/promptComposer';
import type { Team } from '../types';

type UseVirtualEmployeesResult = {
  employees: VirtualEmployee[];
  loading: boolean;
  error: string | null;
  createEmployee: (input: CreateEmployeeInput, team: Team) => Promise<VirtualEmployee | null>;
  updateEmployee: (id: string, updates: Partial<VirtualEmployee>) => Promise<boolean>;
  deleteEmployee: (id: string) => Promise<boolean>;
  refreshEmployees: () => Promise<void>;
};

export function useVirtualEmployees(teamId: string | null): UseVirtualEmployeesResult {
  const [employees, setEmployees] = useState<VirtualEmployee[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all employees for a team
  const fetchEmployees = useCallback(async () => {
    if (!teamId) {
      setEmployees([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('virtual_employees')
        .select('*')
        .eq('team_id', teamId)
        .order('created_at', { ascending: true });

      if (fetchError) throw fetchError;

      setEmployees(data || []);
    } catch (err: any) {
      console.error('Error fetching employees:', err);
      setError(err.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  // Create a new employee
  const createEmployee = useCallback(
    async (input: CreateEmployeeInput, team: Team): Promise<VirtualEmployee | null> => {
      if (!input.teamId) {
        setError('Team ID is required');
        return null;
      }

      setError(null);

      try {
        // Generate random identity
        const identity = generateVirtualEmployeeIdentity();

        // Create initial system prompt
        const initialPrompt = composeEmployeeSystemPrompt(
          {
            name: identity.name,
            title: input.title,
            role_description: input.roleDescription,
            allowed_tools: input.allowedTools || [],
          } as VirtualEmployee,
          team,
          []
        );

        const { data, error: createError } = await supabase
          .from('virtual_employees')
          .insert({
            team_id: input.teamId,
            name: identity.name,
            gender: identity.gender,
            title: input.title,
            role_description: input.roleDescription,
            system_prompt: initialPrompt,
            model_provider: input.modelProvider,
            model_name: input.modelName,
            voice_id: identity.voiceId,
            allowed_tools: input.allowedTools || [],
            oauth_connections: input.oauthConnections || [],
            status: 'idle',
          })
          .select()
          .single();

        if (createError) throw createError;

        // Add to local state
        setEmployees((prev) => [...prev, data]);

        return data;
      } catch (err: any) {
        console.error('Error creating employee:', err);
        setError(err.message || 'Failed to create employee');
        return null;
      }
    },
    []
  );

  // Update employee
  const updateEmployee = useCallback(
    async (id: string, updates: Partial<VirtualEmployee>): Promise<boolean> => {
      setError(null);

      try {
        const { error: updateError } = await supabase
          .from('virtual_employees')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (updateError) throw updateError;

        // Update local state
        setEmployees((prev) =>
          prev.map((emp) =>
            emp.id === id
              ? { ...emp, ...updates, updated_at: new Date().toISOString() }
              : emp
          )
        );

        return true;
      } catch (err: any) {
        console.error('Error updating employee:', err);
        setError(err.message || 'Failed to update employee');
        return false;
      }
    },
    []
  );

  // Delete employee
  const deleteEmployee = useCallback(async (id: string): Promise<boolean> => {
    setError(null);

    try {
      const { error: deleteError } = await supabase
        .from('virtual_employees')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Remove from local state
      setEmployees((prev) => prev.filter((emp) => emp.id !== id));

      return true;
    } catch (err: any) {
      console.error('Error deleting employee:', err);
      setError(err.message || 'Failed to delete employee');
      return false;
    }
  }, []);

  const refreshEmployees = useCallback(async () => {
    await fetchEmployees();
  }, [fetchEmployees]);

  return {
    employees,
    loading,
    error,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    refreshEmployees,
  };
}
