/**
 * useTeams Hook
 * Manages CRUD operations for Teams
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { Team, CreateTeamInput } from '../types';

type UseTeamsResult = {
  teams: Team[];
  loading: boolean;
  error: string | null;
  selectedTeam: Team | null;
  createTeam: (input: CreateTeamInput) => Promise<Team | null>;
  updateTeam: (id: string, updates: Partial<Team>) => Promise<boolean>;
  deleteTeam: (id: string) => Promise<boolean>;
  selectTeam: (team: Team | null) => void;
  refreshTeams: () => Promise<void>;
};

export function useTeams(userId: string | undefined): UseTeamsResult {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  // Fetch all teams for the user
  const fetchTeams = useCallback(async () => {
    if (!userId) {
      setTeams([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('teams')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setTeams(data || []);

      // Auto-select first team if none selected
      if (!selectedTeam && data && data.length > 0) {
        setSelectedTeam(data[0]);
      }
    } catch (err: any) {
      console.error('Error fetching teams:', err);
      setError(err.message || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  }, [userId, selectedTeam]);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  // Create a new team
  const createTeam = useCallback(
    async (input: CreateTeamInput): Promise<Team | null> => {
      if (!userId) {
        setError('User not authenticated');
        return null;
      }

      setError(null);

      try {
        const { data, error: createError } = await supabase
          .from('teams')
          .insert({
            user_id: userId,
            name: input.name,
            mission_statement: input.missionStatement,
          })
          .select()
          .single();

        if (createError) throw createError;

        // Add to local state
        setTeams((prev) => [data, ...prev]);

        // Auto-select the new team
        setSelectedTeam(data);

        return data;
      } catch (err: any) {
        console.error('Error creating team:', err);
        setError(err.message || 'Failed to create team');
        return null;
      }
    },
    [userId]
  );

  // Update team
  const updateTeam = useCallback(
    async (id: string, updates: Partial<Team>): Promise<boolean> => {
      setError(null);

      try {
        const { error: updateError } = await supabase
          .from('teams')
          .update({
            ...updates,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);

        if (updateError) throw updateError;

        // Update local state
        setTeams((prev) =>
          prev.map((team) =>
            team.id === id
              ? { ...team, ...updates, updated_at: new Date().toISOString() }
              : team
          )
        );

        // Update selected team if it's the one being updated
        if (selectedTeam?.id === id) {
          setSelectedTeam((prev) =>
            prev ? { ...prev, ...updates, updated_at: new Date().toISOString() } : null
          );
        }

        return true;
      } catch (err: any) {
        console.error('Error updating team:', err);
        setError(err.message || 'Failed to update team');
        return false;
      }
    },
    [selectedTeam]
  );

  // Delete team
  const deleteTeam = useCallback(
    async (id: string): Promise<boolean> => {
      setError(null);

      try {
        const { error: deleteError } = await supabase.from('teams').delete().eq('id', id);

        if (deleteError) throw deleteError;

        // Remove from local state
        setTeams((prev) => prev.filter((team) => team.id !== id));

        // Clear selection if deleted team was selected
        if (selectedTeam?.id === id) {
          setSelectedTeam(null);
        }

        return true;
      } catch (err: any) {
        console.error('Error deleting team:', err);
        setError(err.message || 'Failed to delete team');
        return false;
      }
    },
    [selectedTeam]
  );

  const selectTeam = useCallback((team: Team | null) => {
    setSelectedTeam(team);
  }, []);

  const refreshTeams = useCallback(async () => {
    await fetchTeams();
  }, [fetchTeams]);

  return {
    teams,
    loading,
    error,
    selectedTeam,
    createTeam,
    updateTeam,
    deleteTeam,
    selectTeam,
    refreshTeams,
  };
}
