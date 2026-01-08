/**
 * useSSMExecution Hook
 *
 * Manages SSM Agent execution state and operations.
 * Handles triggering inference, tracking status, and storing alerts.
 *
 * Security: All event content is sanitized server-side before inference.
 */

import { useState, useCallback, useMemo } from 'react';
import { useCanvasContext } from '../../../context/CanvasStateContext';
import { useAuthSession } from '@/hooks/useAuthSession';
import type {
  SSMAgentNodeConfig,
  SSMAlert,
  SSMExecutionState,
} from '../../../types/ssm';
import type { NodeId } from '../../../types';

// ============================================================================
// TYPES
// ============================================================================

export type SSMExecutionStatus = 'idle' | 'running' | 'success' | 'error';

export interface SSMExecuteParams {
  eventContent: string;
  additionalContext?: string;
}

export interface SSMExecuteResult {
  success: boolean;
  requestId: string;
  result?: {
    type: 'alert' | 'classification' | 'summary' | 'raw';
    data: unknown;
    tokensUsed?: number;
  };
  alert?: SSMAlert;
  error?: string;
  latencyMs: number;
}

export interface UseSSMExecutionResult {
  // State
  status: SSMExecutionStatus;
  lastResult: SSMExecuteResult | null;
  alerts: SSMAlert[];
  executionState: SSMExecutionState;

  // Actions
  execute: (params: SSMExecuteParams) => Promise<SSMExecuteResult>;
  acknowledgeAlert: (alertId: string) => void;
  clearAlerts: () => void;
  resetState: () => void;

  // Computed
  isRunning: boolean;
  hasError: boolean;
  lastError: string | null;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useSSMExecution(
  nodeId: NodeId,
  config: SSMAgentNodeConfig
): UseSSMExecutionResult {
  const { canvas, nodes } = useCanvasContext();
  const { user } = useAuthSession();

  // Execution state
  const [status, setStatus] = useState<SSMExecutionStatus>('idle');
  const [lastResult, setLastResult] = useState<SSMExecuteResult | null>(null);
  const [alerts, setAlerts] = useState<SSMAlert[]>([]);
  const [executionState, setExecutionState] = useState<SSMExecutionState>({
    node_id: nodeId,
    status: 'idle',
    events_processed: 0,
    alerts_generated: 0,
  });

  /**
   * Execute SSM inference with event content
   */
  const execute = useCallback(
    async (params: SSMExecuteParams): Promise<SSMExecuteResult> => {
      const { eventContent, additionalContext } = params;

      // Validate prerequisites
      if (!canvas.current?.id) {
        const errorResult: SSMExecuteResult = {
          success: false,
          requestId: '',
          error: 'No canvas selected',
          latencyMs: 0,
        };
        setLastResult(errorResult);
        return errorResult;
      }

      if (!user?.id) {
        const errorResult: SSMExecuteResult = {
          success: false,
          requestId: '',
          error: 'User not authenticated',
          latencyMs: 0,
        };
        setLastResult(errorResult);
        return errorResult;
      }

      if (!eventContent || eventContent.trim().length === 0) {
        const errorResult: SSMExecuteResult = {
          success: false,
          requestId: '',
          error: 'Event content is required',
          latencyMs: 0,
        };
        setLastResult(errorResult);
        return errorResult;
      }

      // Update status
      setStatus('running');
      setExecutionState(prev => ({
        ...prev,
        status: 'monitoring',
      }));

      try {
        console.log(`[useSSMExecution] Executing inference for node ${nodeId}`);

        const response = await fetch('/api/canvas/ssm/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            canvasId: canvas.current.id,
            nodeId,
            userId: user.id,
            eventContent,
            additionalContext,
          }),
        });

        const result: SSMExecuteResult = await response.json();

        // Update state based on result
        setLastResult(result);

        if (result.success) {
          setStatus('success');
          setExecutionState(prev => ({
            ...prev,
            status: 'idle',
            last_event_at: new Date().toISOString(),
            events_processed: prev.events_processed + 1,
            alerts_generated: prev.alerts_generated + (result.alert ? 1 : 0),
            error_message: undefined,
          }));

          // Add alert to list if generated
          if (result.alert) {
            setAlerts(prev => [result.alert!, ...prev].slice(0, 100)); // Keep max 100 alerts
            console.log(`[useSSMExecution] Alert generated: ${result.alert.severity} - ${result.alert.title}`);
          }

          // Update node config with execution stats
          const node = nodes.list.find(n => n.id === nodeId);
          if (node) {
            await nodes.update(nodeId, {
              config: {
                ...node.config,
                last_executed_at: new Date().toISOString(),
                execution_count: ((node.config as any).execution_count || 0) + 1,
                last_result_type: result.result?.type,
                last_tokens_used: result.result?.tokensUsed,
              },
            });
          }

          console.log(`[useSSMExecution] Execution completed in ${result.latencyMs}ms`);
        } else {
          setStatus('error');
          setExecutionState(prev => ({
            ...prev,
            status: 'error',
            error_message: result.error,
          }));
          console.error(`[useSSMExecution] Execution failed: ${result.error}`);
        }

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorResult: SSMExecuteResult = {
          success: false,
          requestId: '',
          error: errorMessage,
          latencyMs: 0,
        };

        setStatus('error');
        setLastResult(errorResult);
        setExecutionState(prev => ({
          ...prev,
          status: 'error',
          error_message: errorMessage,
        }));

        console.error('[useSSMExecution] Execution error:', error);
        return errorResult;
      }
    },
    [canvas.current?.id, nodeId, user?.id, nodes]
  );

  /**
   * Acknowledge an alert (mark as reviewed)
   */
  const acknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prev =>
      prev.map(alert =>
        alert.id === alertId ? { ...alert, acknowledged: true } : alert
      )
    );
  }, []);

  /**
   * Clear all alerts
   */
  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  /**
   * Reset execution state
   */
  const resetState = useCallback(() => {
    setStatus('idle');
    setLastResult(null);
    setExecutionState({
      node_id: nodeId,
      status: 'idle',
      events_processed: 0,
      alerts_generated: 0,
    });
  }, [nodeId]);

  // Computed values
  const isRunning = useMemo(() => status === 'running', [status]);
  const hasError = useMemo(() => status === 'error', [status]);
  const lastError = useMemo(
    () => (status === 'error' ? lastResult?.error || executionState.error_message || null : null),
    [status, lastResult?.error, executionState.error_message]
  );

  return {
    // State
    status,
    lastResult,
    alerts,
    executionState,

    // Actions
    execute,
    acknowledgeAlert,
    clearAlerts,
    resetState,

    // Computed
    isRunning,
    hasError,
    lastError,
  };
}
