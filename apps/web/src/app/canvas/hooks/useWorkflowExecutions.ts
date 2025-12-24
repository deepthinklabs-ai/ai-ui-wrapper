/**
 * useWorkflowExecutions Hook
 *
 * Fetches and manages workflow executions for a canvas.
 * Provides execution history list, selection, and refresh functionality.
 */

import { useState, useEffect, useCallback } from 'react';
import type { WorkflowExecution, CanvasId } from '../types';
import { supabase } from '@/lib/supabaseClient';

export interface UseWorkflowExecutionsResult {
  /** List of workflow executions */
  executions: WorkflowExecution[];

  /** Currently selected execution for detail view */
  selectedExecution: WorkflowExecution | null;

  /** Select an execution to view details */
  selectExecution: (execution: WorkflowExecution | null) => void;

  /** Refresh the executions list */
  refreshExecutions: () => Promise<void>;

  /** Loading state */
  loading: boolean;

  /** Error message */
  error: string | null;

  /** Total count of executions */
  total: number;
}

export function useWorkflowExecutions(canvasId: CanvasId | null): UseWorkflowExecutionsResult {
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<WorkflowExecution | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);

  /**
   * Fetch executions for the current canvas
   */
  const refreshExecutions = useCallback(async () => {
    if (!canvasId) {
      setExecutions([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get auth session for the request
      const { data: sessionData } = await supabase.auth.getSession();
      const headers: Record<string, string> = {};
      if (sessionData?.session?.access_token) {
        headers['Authorization'] = `Bearer ${sessionData.session.access_token}`;
      }

      const response = await fetch(`/api/canvas/executions?canvasId=${canvasId}&limit=50`, { headers });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch executions');
      }

      setExecutions(data.executions || []);
      setTotal(data.total || 0);
    } catch (err: any) {
      console.error('[useWorkflowExecutions] Error:', err);
      setError(err.message || 'Failed to load executions');
      setExecutions([]);
    } finally {
      setLoading(false);
    }
  }, [canvasId]);

  /**
   * Select an execution for detail view
   */
  const selectExecution = useCallback((execution: WorkflowExecution | null) => {
    setSelectedExecution(execution);
  }, []);

  // Fetch executions when canvasId changes
  useEffect(() => {
    if (canvasId) {
      refreshExecutions();
    } else {
      setExecutions([]);
      setSelectedExecution(null);
      setTotal(0);
    }
  }, [canvasId, refreshExecutions]);

  // Clear selection when canvas changes
  useEffect(() => {
    setSelectedExecution(null);
  }, [canvasId]);

  return {
    executions,
    selectedExecution,
    selectExecution,
    refreshExecutions,
    loading,
    error,
    total,
  };
}
