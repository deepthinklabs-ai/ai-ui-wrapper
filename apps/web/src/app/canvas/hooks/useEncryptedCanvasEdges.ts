/**
 * useEncryptedCanvasEdges Hook
 *
 * A wrapper around useCanvasEdges that adds client-side encryption.
 * - Encrypts edge label, condition, and transform before storing
 * - Decrypts these fields when loading from database
 *
 * Sensitive fields encrypted:
 * - label - edge display name
 * - condition - conditional logic expression
 * - transform - data transformation expression
 *
 * Uses structured error handling and circuit breaker for resilience.
 */

import { useState, useEffect, useCallback } from 'react';
import { useEncryption } from '@/contexts/EncryptionContext';
import { useCanvasEdges } from './useCanvasEdges';
import type {
  CanvasEdge,
  EdgeId,
  NodeId,
  CanvasId,
  UseCanvasEdgesResult,
} from '../types';
import {
  validateDecryption,
  isDecryptionSuccess,
} from '@/lib/decryptionValidator';
import { getCircuitBreaker } from '@/lib/decryptionCircuitBreaker';
import { EncryptionError, isEncryptionError } from '@/lib/encryptionErrors';

interface UseEncryptedCanvasEdgesResult extends Omit<UseCanvasEdgesResult, 'edges'> {
  edges: CanvasEdge[];
  encryptionError: string | null;
  encryptionErrorCode: string | null;
  isEncryptionReady: boolean;
  isCircuitBreakerOpen: boolean;
  resetCircuitBreaker: () => void;
}

export function useEncryptedCanvasEdges(canvasId: CanvasId | null): UseEncryptedCanvasEdgesResult {
  const [decryptedEdges, setDecryptedEdges] = useState<CanvasEdge[]>([]);
  const [encryptionError, setEncryptionError] = useState<string | null>(null);
  const [encryptionErrorCode, setEncryptionErrorCode] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isCircuitBreakerOpen, setIsCircuitBreakerOpen] = useState(false);

  // Get circuit breaker for canvas edges
  const circuitBreaker = getCircuitBreaker('canvas-edges');

  // Get encryption functions
  const {
    encryptText,
    decryptText,
    isReady: isEncryptionReady,
    state: encryptionState,
  } = useEncryption();

  // Get base canvas edges
  const baseEdges = useCanvasEdges(canvasId);

  // Subscribe to circuit breaker state changes
  useEffect(() => {
    const unsubscribe = circuitBreaker.subscribe((state) => {
      setIsCircuitBreakerOpen(state.isOpen);
      if (state.isOpen && state.lastError) {
        setEncryptionError(state.lastError.getUserMessage());
        setEncryptionErrorCode(state.lastError.code);
      }
    });
    return unsubscribe;
  }, [circuitBreaker]);

  /**
   * Reset the circuit breaker manually
   */
  const resetCircuitBreaker = useCallback(() => {
    circuitBreaker.reset();
    setIsCircuitBreakerOpen(false);
    setEncryptionError(null);
    setEncryptionErrorCode(null);
  }, [circuitBreaker]);

  /**
   * Decrypt a single edge's sensitive fields with validation
   */
  const decryptEdge = useCallback(async (edge: CanvasEdge): Promise<CanvasEdge> => {
    // Check circuit breaker first
    if (circuitBreaker.isCircuitOpen()) {
      return edge;
    }

    let decryptedLabel = edge.label;
    let decryptedCondition = edge.condition;
    let decryptedTransform = edge.transform;
    let hasSuccess = false;

    // Decrypt label
    if (edge.label) {
      const labelResult = await validateDecryption(
        edge.label,
        decryptText,
        { itemId: edge.id, itemType: 'edge-label' }
      );

      if (isDecryptionSuccess(labelResult)) {
        decryptedLabel = labelResult.data;
        hasSuccess = true;
      } else if (labelResult.error.code !== 'LOCKED') {
        circuitBreaker.recordFailure(labelResult.error);
        console.warn(
          `[EncryptedCanvasEdges] Label decryption ${labelResult.status} for edge ${edge.id}:`,
          labelResult.error.code
        );
      }
    }

    // Decrypt condition
    if (edge.condition) {
      const conditionResult = await validateDecryption(
        edge.condition,
        decryptText,
        { itemId: edge.id, itemType: 'edge-condition' }
      );

      if (isDecryptionSuccess(conditionResult)) {
        decryptedCondition = conditionResult.data;
        hasSuccess = true;
      } else if (conditionResult.error.code !== 'LOCKED') {
        circuitBreaker.recordFailure(conditionResult.error);
        console.warn(
          `[EncryptedCanvasEdges] Condition decryption ${conditionResult.status} for edge ${edge.id}:`,
          conditionResult.error.code
        );
      }
    }

    // Decrypt transform
    if (edge.transform) {
      const transformResult = await validateDecryption(
        edge.transform,
        decryptText,
        { itemId: edge.id, itemType: 'edge-transform' }
      );

      if (isDecryptionSuccess(transformResult)) {
        decryptedTransform = transformResult.data;
        hasSuccess = true;
      } else if (transformResult.error.code !== 'LOCKED') {
        circuitBreaker.recordFailure(transformResult.error);
        console.warn(
          `[EncryptedCanvasEdges] Transform decryption ${transformResult.status} for edge ${edge.id}:`,
          transformResult.error.code
        );
      }
    }

    // Record success if any field was decrypted
    if (hasSuccess) {
      circuitBreaker.recordSuccess();
    }

    return {
      ...edge,
      label: decryptedLabel,
      condition: decryptedCondition,
      transform: decryptedTransform,
    };
  }, [decryptText, circuitBreaker]);

  /**
   * Decrypt all edges when base edges change
   */
  useEffect(() => {
    // Don't try to decrypt if encryption isn't ready
    if (!isEncryptionReady || baseEdges.loading) {
      return;
    }

    // If encryption isn't set up, just use the edges as-is
    if (!encryptionState.hasEncryption) {
      setDecryptedEdges(baseEdges.edges);
      return;
    }

    // If encryption is set up but not unlocked, show empty edges
    if (!encryptionState.isUnlocked) {
      setDecryptedEdges([]);
      return;
    }

    const decryptAll = async () => {
      if (baseEdges.edges.length === 0) {
        setDecryptedEdges([]);
        return;
      }

      setIsDecrypting(true);
      setEncryptionError(null);

      try {
        const decrypted = await Promise.all(
          baseEdges.edges.map(decryptEdge)
        );
        setDecryptedEdges(decrypted);
      } catch (err: any) {
        console.error('[EncryptedCanvasEdges] Failed to decrypt edges:', err);
        setEncryptionError('Failed to decrypt canvas edges. Your encryption key may have changed.');
        setDecryptedEdges(baseEdges.edges);
      } finally {
        setIsDecrypting(false);
      }
    };

    decryptAll();
  }, [
    baseEdges.edges,
    baseEdges.loading,
    isEncryptionReady,
    encryptionState.hasEncryption,
    encryptionState.isUnlocked,
    decryptEdge,
  ]);

  /**
   * Add edge with encryption
   */
  const addEdge = useCallback(
    async (
      from: NodeId,
      to: NodeId,
      config?: Partial<CanvasEdge>
    ): Promise<CanvasEdge | null> => {
      if (!isEncryptionReady || !encryptionState.isUnlocked) {
        // No encryption, pass through
        return baseEdges.addEdge(from, to, config);
      }

      try {
        const encryptedConfig: Partial<CanvasEdge> = { ...config };

        // Encrypt label
        if (config?.label) {
          encryptedConfig.label = await encryptText(config.label);
        }

        // Encrypt condition
        if (config?.condition) {
          encryptedConfig.condition = await encryptText(config.condition);
        }

        // Encrypt transform
        if (config?.transform) {
          encryptedConfig.transform = await encryptText(config.transform);
        }

        const result = await baseEdges.addEdge(from, to, encryptedConfig);

        if (result) {
          // Return decrypted version for local state
          return {
            ...result,
            label: config?.label,
            condition: config?.condition,
            transform: config?.transform,
          };
        }
        return null;
      } catch (err) {
        console.error('[EncryptedCanvasEdges] Failed to encrypt edge:', err);
        return null;
      }
    },
    [baseEdges.addEdge, isEncryptionReady, encryptionState.isUnlocked, encryptText]
  );

  /**
   * Update edge with encryption
   */
  const updateEdge = useCallback(
    async (id: EdgeId, updates: Partial<CanvasEdge>): Promise<boolean> => {
      if (!isEncryptionReady || !encryptionState.isUnlocked) {
        // No encryption, pass through
        return baseEdges.updateEdge(id, updates);
      }

      try {
        const encryptedUpdates: Partial<CanvasEdge> = { ...updates };

        // Encrypt label if being updated
        if (updates.label !== undefined) {
          encryptedUpdates.label = await encryptText(updates.label);
        }

        // Encrypt condition if being updated
        if (updates.condition !== undefined) {
          encryptedUpdates.condition = await encryptText(updates.condition);
        }

        // Encrypt transform if being updated
        if (updates.transform !== undefined) {
          encryptedUpdates.transform = await encryptText(updates.transform);
        }

        const result = await baseEdges.updateEdge(id, encryptedUpdates);

        if (result) {
          // Update local decrypted state
          setDecryptedEdges(prev =>
            prev.map(edge =>
              edge.id === id ? { ...edge, ...updates } : edge
            )
          );
        }

        return result;
      } catch (err) {
        console.error('[EncryptedCanvasEdges] Failed to encrypt edge update:', err);
        return false;
      }
    },
    [baseEdges.updateEdge, isEncryptionReady, encryptionState.isUnlocked, encryptText]
  );

  return {
    edges: decryptedEdges,
    loading: baseEdges.loading || isDecrypting || encryptionState.isLoading,
    encryptionError,
    encryptionErrorCode,
    isEncryptionReady,
    isCircuitBreakerOpen,
    resetCircuitBreaker,
    addEdge,
    updateEdge,
    deleteEdge: baseEdges.deleteEdge,
    refreshEdges: baseEdges.refreshEdges,
  };
}
