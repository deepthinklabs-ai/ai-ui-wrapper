/**
 * useExposedWorkflows Hook
 *
 * Fetches and manages exposed workflows for the Dashboard.
 * Provides workflow selection, triggering, and state management.
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  ExposedWorkflow,
  MasterTriggerInput,
  MasterTriggerOutput,
  TriggerWorkflowResponse,
} from '@/app/canvas/features/master-trigger/types';

export interface UseExposedWorkflowsResult {
  /** List of available exposed workflows */
  workflows: ExposedWorkflow[];

  /** Currently selected workflow (null = default chat mode) */
  selectedWorkflow: ExposedWorkflow | null;

  /** Select a workflow for message routing */
  selectWorkflow: (workflow: ExposedWorkflow | null) => void;

  /** Trigger a workflow with input */
  triggerWorkflow: (input: MasterTriggerInput) => Promise<MasterTriggerOutput | null>;

  /** Loading state for fetching workflows */
  isLoading: boolean;

  /** Loading state for workflow execution */
  isExecuting: boolean;

  /** Error message */
  error: string | null;

  /** Refresh the workflows list */
  refresh: () => Promise<void>;
}

export function useExposedWorkflows(userId: string | null): UseExposedWorkflowsResult {
  const [workflows, setWorkflows] = useState<ExposedWorkflow[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<ExposedWorkflow | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch exposed workflows from the API
   */
  const fetchWorkflows = useCallback(async () => {
    if (!userId) {
      setWorkflows([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/workflows/exposed?userId=${userId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch workflows');
      }

      setWorkflows(data.workflows || []);
      console.log(`[useExposedWorkflows] Loaded ${data.workflows?.length || 0} workflows`);
    } catch (err: any) {
      console.error('[useExposedWorkflows] Error fetching workflows:', err);
      setError(err.message || 'Failed to fetch workflows');
      setWorkflows([]);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  /**
   * Select a workflow for message routing
   */
  const selectWorkflow = useCallback((workflow: ExposedWorkflow | null) => {
    setSelectedWorkflow(workflow);
    setError(null);

    if (workflow) {
      console.log(`[useExposedWorkflows] Selected workflow: ${workflow.displayName}`);
    } else {
      console.log('[useExposedWorkflows] Cleared workflow selection (default chat mode)');
    }
  }, []);

  /**
   * Trigger the selected workflow with input
   */
  const triggerWorkflow = useCallback(
    async (input: MasterTriggerInput): Promise<MasterTriggerOutput | null> => {
      if (!selectedWorkflow) {
        setError('No workflow selected');
        return null;
      }

      setIsExecuting(true);
      setError(null);

      try {
        const response = await fetch('/api/workflows/trigger', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            canvasId: selectedWorkflow.canvasId,
            triggerNodeId: selectedWorkflow.triggerNodeId,
            input,
          }),
        });

        const data: TriggerWorkflowResponse = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Workflow execution failed');
        }

        console.log(`[useExposedWorkflows] Workflow executed successfully in ${data.output?.duration_ms}ms`);
        return data.output || null;
      } catch (err: any) {
        console.error('[useExposedWorkflows] Error triggering workflow:', err);
        setError(err.message || 'Workflow execution failed');
        return null;
      } finally {
        setIsExecuting(false);
      }
    },
    [selectedWorkflow]
  );

  // Fetch workflows on mount and when userId changes
  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  return {
    workflows,
    selectedWorkflow,
    selectWorkflow,
    triggerWorkflow,
    isLoading,
    isExecuting,
    error,
    refresh: fetchWorkflows,
  };
}
