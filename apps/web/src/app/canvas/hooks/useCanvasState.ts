/**
 * useCanvasState Hook
 *
 * Centralized state management for Canvas page.
 * Consolidates loading states, error handling, and provides unified API.
 *
 * Phase 2 Improvements:
 * - Unified loading state (know WHAT is loading)
 * - Centralized error handling with user feedback
 * - Operation tracking
 */

import { useState, useCallback } from 'react';

export type LoadingEntity = 'canvas' | 'node' | 'edge' | 'none';
export type LoadingOperation =
  | 'fetching'
  | 'creating'
  | 'updating'
  | 'deleting'
  | 'duplicating'
  | 'none';

export interface LoadingState {
  entity: LoadingEntity;
  operation: LoadingOperation;
  entityId?: string;
}

export interface CanvasError {
  entity: LoadingEntity;
  operation: LoadingOperation;
  message: string;
  entityId?: string;
  timestamp: number;
  canRetry?: boolean;
}

export interface UseCanvasStateResult {
  // Loading state
  loading: LoadingState;
  isLoading: boolean;
  setLoading: (entity: LoadingEntity, operation: LoadingOperation, entityId?: string) => void;
  clearLoading: () => void;
  getLoadingMessage: () => string;

  // Error state
  error: CanvasError | null;
  setError: (entity: LoadingEntity, operation: LoadingOperation, message: string, entityId?: string, canRetry?: boolean) => void;
  clearError: () => void;

  // Combined helpers
  isCanvasLoading: boolean;
  isNodesLoading: boolean;
  isEdgesLoading: boolean;
}

const DEFAULT_LOADING_STATE: LoadingState = {
  entity: 'none',
  operation: 'none',
};

export function useCanvasState(): UseCanvasStateResult {
  const [loading, setLoadingState] = useState<LoadingState>(DEFAULT_LOADING_STATE);
  const [error, setErrorState] = useState<CanvasError | null>(null);

  // Loading management
  const setLoading = useCallback(
    (entity: LoadingEntity, operation: LoadingOperation, entityId?: string) => {
      setLoadingState({ entity, operation, entityId });
    },
    []
  );

  const clearLoading = useCallback(() => {
    setLoadingState(DEFAULT_LOADING_STATE);
  }, []);

  const getLoadingMessage = useCallback((): string => {
    const { entity, operation } = loading;

    if (entity === 'none' || operation === 'none') return '';

    const operationText = {
      fetching: 'Loading',
      creating: 'Creating',
      updating: 'Updating',
      deleting: 'Deleting',
      duplicating: 'Duplicating',
      none: '',
    }[operation];

    const entityText = {
      canvas: 'canvas',
      node: 'node',
      edge: 'connection',
      none: '',
    }[entity];

    return `${operationText} ${entityText}...`;
  }, [loading]);

  // Error management
  const setError = useCallback(
    (
      entity: LoadingEntity,
      operation: LoadingOperation,
      message: string,
      entityId?: string,
      canRetry: boolean = false
    ) => {
      setErrorState({
        entity,
        operation,
        message,
        entityId,
        timestamp: Date.now(),
        canRetry,
      });
      // Auto-clear loading state when error occurs
      clearLoading();
    },
    [clearLoading]
  );

  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);

  // Computed properties
  const isLoading = loading.entity !== 'none' && loading.operation !== 'none';
  const isCanvasLoading = loading.entity === 'canvas';
  const isNodesLoading = loading.entity === 'node';
  const isEdgesLoading = loading.entity === 'edge';

  return {
    loading,
    isLoading,
    setLoading,
    clearLoading,
    getLoadingMessage,
    error,
    setError,
    clearError,
    isCanvasLoading,
    isNodesLoading,
    isEdgesLoading,
  };
}
