/**
 * useEncryptedCanvasNodes Hook
 *
 * A wrapper around useCanvasNodes that adds client-side encryption.
 * - Encrypts node config and label before storing to database
 * - Decrypts node config and label when loading from database
 *
 * Sensitive fields encrypted:
 * - config (JSONB) - contains system prompts, API configs, etc.
 * - label - node display name
 *
 * Uses structured error handling and circuit breaker for resilience.
 */

import { useState, useEffect, useCallback } from 'react';
import { useEncryption } from '@/contexts/EncryptionContext';
import { useCanvasNodes } from './useCanvasNodes';
import type {
  CanvasNode,
  CanvasNodeType,
  NodeId,
  CanvasId,
  UseCanvasNodesResult,
} from '../types';
import {
  validateDecryption,
  validateJSONDecryption,
  isDecryptionSuccess,
} from '@/lib/decryptionValidator';
import { getCircuitBreaker } from '@/lib/decryptionCircuitBreaker';
import { EncryptionError, isEncryptionError } from '@/lib/encryptionErrors';

interface UseEncryptedCanvasNodesResult extends Omit<UseCanvasNodesResult, 'nodes'> {
  nodes: CanvasNode[];
  encryptionError: string | null;
  encryptionErrorCode: string | null;
  isEncryptionReady: boolean;
  isCircuitBreakerOpen: boolean;
  resetCircuitBreaker: () => void;
}

export function useEncryptedCanvasNodes(canvasId: CanvasId | null): UseEncryptedCanvasNodesResult {
  const [decryptedNodes, setDecryptedNodes] = useState<CanvasNode[]>([]);
  const [encryptionError, setEncryptionError] = useState<string | null>(null);
  const [encryptionErrorCode, setEncryptionErrorCode] = useState<string | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [isCircuitBreakerOpen, setIsCircuitBreakerOpen] = useState(false);

  // Get circuit breaker for canvas nodes
  const circuitBreaker = getCircuitBreaker('canvas-nodes');

  // Get encryption functions
  const {
    encryptText,
    decryptText,
    encryptObject,
    decryptObject,
    isReady: isEncryptionReady,
    state: encryptionState,
  } = useEncryption();

  // Get base canvas nodes
  const baseNodes = useCanvasNodes(canvasId);

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
   * Decrypt a single node's sensitive fields with validation
   */
  const decryptNode = useCallback(async (node: CanvasNode): Promise<CanvasNode> => {
    // Check circuit breaker first
    if (circuitBreaker.isCircuitOpen()) {
      return node;
    }

    let decryptedConfig = node.config;
    let decryptedLabel = node.label;
    let hasError = false;

    // Decrypt config (JSONB)
    if (node.config && typeof node.config === 'string') {
      const configResult = await validateJSONDecryption<Record<string, any>>(
        node.config,
        decryptObject,
        { itemId: node.id, itemType: 'node-config' }
      );

      if (isDecryptionSuccess(configResult)) {
        decryptedConfig = configResult.data as Record<string, any>;
        circuitBreaker.recordSuccess();
      } else {
        hasError = true;
        if (configResult.error.code !== 'LOCKED') {
          circuitBreaker.recordFailure(configResult.error);
        }
        console.warn(
          `[EncryptedCanvasNodes] Config decryption ${configResult.status} for node ${node.id}:`,
          configResult.error.code
        );
      }
    }

    // Decrypt label
    if (node.label) {
      const labelResult = await validateDecryption(
        node.label,
        decryptText,
        { itemId: node.id, itemType: 'node-label' }
      );

      if (isDecryptionSuccess(labelResult)) {
        decryptedLabel = labelResult.data;
        if (!hasError) circuitBreaker.recordSuccess();
      } else {
        if (labelResult.error.code !== 'LOCKED') {
          circuitBreaker.recordFailure(labelResult.error);
        }
        console.warn(
          `[EncryptedCanvasNodes] Label decryption ${labelResult.status} for node ${node.id}:`,
          labelResult.error.code
        );
      }
    }

    return {
      ...node,
      config: decryptedConfig,
      label: decryptedLabel,
    };
  }, [decryptText, decryptObject, circuitBreaker]);

  /**
   * Decrypt all nodes when base nodes change
   */
  useEffect(() => {
    // Don't try to decrypt if encryption isn't ready
    if (!isEncryptionReady || baseNodes.loading) {
      return;
    }

    // If encryption isn't set up, just use the nodes as-is
    if (!encryptionState.hasEncryption) {
      setDecryptedNodes(baseNodes.nodes);
      return;
    }

    // If encryption is set up but not unlocked, show empty nodes
    if (!encryptionState.isUnlocked) {
      setDecryptedNodes([]);
      return;
    }

    const decryptAll = async () => {
      if (baseNodes.nodes.length === 0) {
        setDecryptedNodes([]);
        return;
      }

      setIsDecrypting(true);
      setEncryptionError(null);

      try {
        const decrypted = await Promise.all(
          baseNodes.nodes.map(decryptNode)
        );
        setDecryptedNodes(decrypted);
      } catch (err: any) {
        console.error('[EncryptedCanvasNodes] Failed to decrypt nodes:', err);
        setEncryptionError('Failed to decrypt canvas nodes. Your encryption key may have changed.');
        setDecryptedNodes(baseNodes.nodes);
      } finally {
        setIsDecrypting(false);
      }
    };

    decryptAll();
  }, [
    baseNodes.nodes,
    baseNodes.loading,
    isEncryptionReady,
    encryptionState.hasEncryption,
    encryptionState.isUnlocked,
    decryptNode,
  ]);

  /**
   * Add node with encryption
   */
  const addNode = useCallback(
    async (
      type: CanvasNodeType,
      position: { x: number; y: number },
      config?: any
    ): Promise<CanvasNode | null> => {
      if (!isEncryptionReady || !encryptionState.isUnlocked) {
        // No encryption, pass through
        return baseNodes.addNode(type, position, config);
      }

      try {
        // Extract is_exposed before encryption (for MASTER_TRIGGER nodes)
        const hasIsExposed = config && typeof config === 'object' && 'is_exposed' in config;
        const isExposedValue = hasIsExposed ? config.is_exposed : undefined;

        // Encrypt config before saving
        let encryptedConfig = config;
        if (config) {
          encryptedConfig = await encryptObject(config);
        }

        const result = await baseNodes.addNode(type, position, encryptedConfig);

        if (result) {
          // If this node has is_exposed, update the column separately
          // (because the encrypted config can't be read by useCanvasNodes)
          if (hasIsExposed && isExposedValue !== undefined) {
            await baseNodes.updateNode(result.id, { is_exposed: isExposedValue } as any);
          }

          // Return decrypted version for local state
          return {
            ...result,
            config: config, // Use original unencrypted config
            is_exposed: isExposedValue,
          };
        }
        return null;
      } catch (err) {
        console.error('[EncryptedCanvasNodes] Failed to encrypt node:', err);
        return null;
      }
    },
    [baseNodes.addNode, baseNodes.updateNode, isEncryptionReady, encryptionState.isUnlocked, encryptObject]
  );

  /**
   * Update node with encryption
   */
  const updateNode = useCallback(
    async (id: NodeId, updates: Partial<CanvasNode>): Promise<boolean> => {
      if (!isEncryptionReady || !encryptionState.isUnlocked) {
        // No encryption, pass through
        return baseNodes.updateNode(id, updates);
      }

      try {
        // Use 'any' for encrypted updates since encrypted config is a string
        const encryptedUpdates: Record<string, any> = { ...updates };

        // IMPORTANT: Extract is_exposed BEFORE encrypting config
        // This field needs to stay unencrypted for the API to query exposed workflows
        if (updates.config !== undefined && typeof updates.config === 'object' && 'is_exposed' in updates.config) {
          encryptedUpdates.is_exposed = (updates.config as any).is_exposed;
        }

        // IMPORTANT: Build runtime_config BEFORE encrypting config
        // This stores non-sensitive fields unencrypted for server-side workflow access
        // (model_provider, model_name, integration flags) - since encrypted config can't be read server-side
        if (updates.config !== undefined && typeof updates.config === 'object') {
          const config = updates.config as any;
          // Check if this looks like a GenesisBotNodeConfig (has model info or integration flags)
          if (config.model_provider || config.model_name || config.system_prompt !== undefined ||
              config.gmail || config.calendar || config.sheets || config.docs || config.slack) {
            encryptedUpdates.runtime_config = {
              name: config.name,
              model_provider: config.model_provider,
              model_name: config.model_name,
              gmail_enabled: config.gmail?.enabled || false,
              calendar_enabled: config.calendar?.enabled || false,
              sheets_enabled: config.sheets?.enabled || false,
              docs_enabled: config.docs?.enabled || false,
              slack_enabled: config.slack?.enabled || false,
            };
          }
          // Check if this looks like an SSMAgentNodeConfig (has is_enabled, trained_at, monitoring_description)
          if ('is_enabled' in config || 'trained_at' in config || 'monitoring_description' in config) {
            encryptedUpdates.runtime_config = {
              ...(encryptedUpdates.runtime_config || {}),
              name: config.name,
              is_enabled: config.is_enabled || false,
              trained_at: config.trained_at,
              trained_by: config.trained_by,
              gmail_enabled: config.gmail?.enabled || false,
              gmail_connection_id: config.gmail?.connectionId,
              calendar_enabled: config.calendar?.enabled || false,
              sheets_enabled: config.sheets?.enabled || false,
              docs_enabled: config.docs?.enabled || false,
              slack_enabled: config.slack?.enabled || false,
            };
          }
        }

        // Encrypt config if being updated (stored as encrypted string in JSONB)
        if (updates.config !== undefined) {
          encryptedUpdates.config = await encryptObject(updates.config);
        }

        // Encrypt label if being updated
        if (updates.label !== undefined) {
          encryptedUpdates.label = await encryptText(updates.label);
        }

        const result = await baseNodes.updateNode(id, encryptedUpdates as Partial<CanvasNode>);

        if (result) {
          // Update local decrypted state
          setDecryptedNodes(prev =>
            prev.map(node =>
              node.id === id ? { ...node, ...updates } : node
            )
          );
        }

        return result;
      } catch (err) {
        console.error('[EncryptedCanvasNodes] Failed to encrypt node update:', err);
        return false;
      }
    },
    [baseNodes.updateNode, isEncryptionReady, encryptionState.isUnlocked, encryptText, encryptObject]
  );

  /**
   * Duplicate node with encryption
   */
  const duplicateNode = useCallback(
    async (id: NodeId): Promise<CanvasNode | null> => {
      const originalNode = decryptedNodes.find(n => n.id === id);
      if (!originalNode) return null;

      // Use decrypted config for duplication
      return addNode(
        originalNode.type,
        {
          x: originalNode.position.x + 50,
          y: originalNode.position.y + 50,
        },
        { ...originalNode.config }
      );
    },
    [decryptedNodes, addNode]
  );

  return {
    nodes: decryptedNodes,
    loading: baseNodes.loading || isDecrypting || encryptionState.isLoading,
    encryptionError,
    encryptionErrorCode,
    isEncryptionReady,
    isCircuitBreakerOpen,
    resetCircuitBreaker,
    addNode,
    updateNode,
    deleteNode: baseNodes.deleteNode,
    duplicateNode,
    refreshNodes: baseNodes.refreshNodes,
  };
}
