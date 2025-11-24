/**
 * useCanvasLoading Hook
 *
 * Centralized loading state management for Canvas operations.
 * Tracks which entity is loading, operation type, and affected IDs.
 *
 * Benefits:
 * - Single source of truth for loading states
 * - Granular loading indicators (know WHAT is loading)
 * - Better UX with specific loading messages
 * - Prevents state conflicts
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
  message?: string;
}

export interface UseCanvasLoadingResult {
  loading: LoadingState;
  isLoading: boolean;
  setLoading: (entity: LoadingEntity, operation: LoadingOperation, entityId?: string, message?: string) => void;
  clearLoading: () => void;
  getLoadingMessage: () => string;
}

const DEFAULT_LOADING_STATE: LoadingState = {
  entity: 'none',
  operation: 'none',
};

export function useCanvasLoading(): UseCanvasLoadingResult {
  const [loading, setLoadingState] = useState<LoadingState>(DEFAULT_LOADING_STATE);

  const setLoading = useCallback(
    (
      entity: LoadingEntity,
      operation: LoadingOperation,
      entityId?: string,
      message?: string
    ) => {
      setLoadingState({
        entity,
        operation,
        entityId,
        message,
      });
    },
    []
  );

  const clearLoading = useCallback(() => {
    setLoadingState(DEFAULT_LOADING_STATE);
  }, []);

  const getLoadingMessage = useCallback((): string => {
    if (loading.message) return loading.message;

    const { entity, operation } = loading;

    // Generate default messages
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

  const isLoading = loading.entity !== 'none' && loading.operation !== 'none';

  return {
    loading,
    isLoading,
    setLoading,
    clearLoading,
    getLoadingMessage,
  };
}
