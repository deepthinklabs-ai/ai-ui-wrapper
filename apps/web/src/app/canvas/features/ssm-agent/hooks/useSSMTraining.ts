/**
 * useSSMTraining Hook
 *
 * Manages SSM training session state and API interactions.
 * Handles multi-turn conversation for gathering monitoring requirements.
 *
 * Separation:
 * - State management in this hook
 * - API calls to /api/canvas/ssm/training
 * - UI rendering in components
 */

import { useState, useCallback, useRef } from 'react';
import type {
  SSMTrainingSession,
  SSMTrainingMessage,
  SSMTrainingPhase,
  SSMExtractedInfo,
  SSMTrainingRequest,
  SSMTrainingResponse,
  SSMFinalizeTrainingRequest,
  SSMFinalizeTrainingResponse,
} from '../types/training';
import type { SSMRulesConfig, SSMResponseTemplate } from '../../../types/ssm';

// ============================================================================
// TYPES
// ============================================================================

export interface UseSSMTrainingOptions {
  nodeId: string;
  canvasId: string;
  userId: string;
  provider: 'claude' | 'openai';
  onTrainingComplete?: (result: TrainingResult) => void;
}

export interface TrainingResult {
  monitoringDescription: string;
  rules: SSMRulesConfig;
  responseTemplates: SSMResponseTemplate[];
}

export interface UseSSMTrainingReturn {
  // State
  isOpen: boolean;
  isLoading: boolean;
  isFinalizing: boolean;
  session: SSMTrainingSession | null;
  messages: SSMTrainingMessage[];
  phase: SSMTrainingPhase;
  extractedInfo: SSMExtractedInfo;
  error: string | null;
  sessionStartedAt: string | null; // For countdown timer

  // Actions
  openTraining: () => void;
  closeTraining: () => void;
  sendMessage: (message: string) => Promise<void>;
  finalize: () => Promise<TrainingResult | null>;
  reset: () => void;
}

// ============================================================================
// INITIAL STATE
// ============================================================================

const INITIAL_SESSION: SSMTrainingSession = {
  id: '',
  nodeId: '',
  canvasId: '',
  userId: '',
  phase: 'greeting',
  messages: [],
  startedAt: new Date().toISOString(),
  extractedInfo: {},
};

// ============================================================================
// HOOK
// ============================================================================

export function useSSMTraining(options: UseSSMTrainingOptions): UseSSMTrainingReturn {
  const { nodeId, canvasId, userId, provider, onTrainingComplete } = options;

  // State
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [session, setSession] = useState<SSMTrainingSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);

  // Session ID ref (persists across renders)
  const sessionIdRef = useRef<string | null>(null);

  // ============================================================================
  // DERIVED STATE
  // ============================================================================

  const messages = session?.messages ?? [];
  const phase = session?.phase ?? 'greeting';
  const extractedInfo = session?.extractedInfo ?? {};

  // ============================================================================
  // ACTIONS
  // ============================================================================

  /**
   * Open training modal and start a new session
   */
  const openTraining = useCallback(() => {
    setIsOpen(true);
    setError(null);

    // Initialize a new session locally
    const newSession: SSMTrainingSession = {
      ...INITIAL_SESSION,
      nodeId,
      canvasId,
      userId,
      startedAt: new Date().toISOString(),
    };
    setSession(newSession);
    sessionIdRef.current = null;
  }, [nodeId, canvasId, userId]);

  /**
   * Close training modal
   */
  const closeTraining = useCallback(() => {
    setIsOpen(false);
    // Don't reset session - user might want to continue later
  }, []);

  /**
   * Send a message in the training conversation
   */
  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const request: SSMTrainingRequest = {
        sessionId: sessionIdRef.current || undefined,
        nodeId,
        canvasId,
        userId,
        message: message.trim(),
        provider,
      };

      const response = await fetch('/api/canvas/ssm/training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Training API error: ${response.status}`);
      }

      const data: SSMTrainingResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Training failed');
      }

      // Update session ID and start time
      sessionIdRef.current = data.sessionId;
      if (data.sessionStartedAt) {
        setSessionStartedAt(data.sessionStartedAt);
      }

      // Update session state
      setSession(prev => {
        if (!prev) return prev;

        // Add user message
        const userMessage: SSMTrainingMessage = {
          id: `user_${Date.now()}`,
          role: 'user',
          content: message.trim(),
          timestamp: new Date().toISOString(),
        };

        return {
          ...prev,
          id: data.sessionId,
          phase: data.phase,
          messages: [...prev.messages, userMessage, data.message],
          extractedInfo: data.extractedInfo,
          completedAt: data.isComplete ? new Date().toISOString() : undefined,
        };
      });

      // Check if training is complete
      if (data.isComplete) {
        // Auto-finalize
        await finalizeInternal();
      }

    } catch (err) {
      console.error('[useSSMTraining] sendMessage error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setIsLoading(false);
    }
  }, [nodeId, canvasId, userId, provider]);

  /**
   * Internal finalize function
   */
  const finalizeInternal = useCallback(async (): Promise<TrainingResult | null> => {
    if (!sessionIdRef.current) {
      setError('No active session to finalize');
      return null;
    }

    setIsFinalizing(true);
    setError(null);

    try {
      const request: SSMFinalizeTrainingRequest = {
        sessionId: sessionIdRef.current,
        nodeId,
        provider,
      };

      const response = await fetch('/api/canvas/ssm/training/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Finalize API error: ${response.status}`);
      }

      const data: SSMFinalizeTrainingResponse = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to generate rules');
      }

      const result: TrainingResult = {
        monitoringDescription: data.monitoringDescription,
        rules: data.rules,
        responseTemplates: data.responseTemplates,
      };

      // Update session to complete
      setSession(prev => prev ? {
        ...prev,
        phase: 'complete',
        completedAt: new Date().toISOString(),
      } : prev);

      // Callback
      onTrainingComplete?.(result);

      return result;

    } catch (err) {
      console.error('[useSSMTraining] finalize error:', err);
      setError(err instanceof Error ? err.message : 'Failed to finalize training');
      return null;
    } finally {
      setIsFinalizing(false);
    }
  }, [nodeId, provider, onTrainingComplete]);

  /**
   * Manually finalize training
   */
  const finalize = useCallback(async (): Promise<TrainingResult | null> => {
    return finalizeInternal();
  }, [finalizeInternal]);

  /**
   * Reset training session
   */
  const reset = useCallback(() => {
    setSession(null);
    setError(null);
    setIsLoading(false);
    setIsFinalizing(false);
    setSessionStartedAt(null);
    sessionIdRef.current = null;
  }, []);

  // ============================================================================
  // RETURN
  // ============================================================================

  return {
    // State
    isOpen,
    isLoading,
    isFinalizing,
    session,
    messages,
    phase,
    extractedInfo,
    error,
    sessionStartedAt,

    // Actions
    openTraining,
    closeTraining,
    sendMessage,
    finalize,
    reset,
  };
}

export default useSSMTraining;
