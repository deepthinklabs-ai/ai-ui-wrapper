'use client';

/**
 * useMasterTrigger Hook
 *
 * Manages Master Trigger node configuration within a canvas:
 * - Toggle exposure on/off
 * - Update trigger configuration
 * - Get connected nodes
 */

import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type { CanvasNode, MasterTriggerNodeConfig, NodeId, CanvasId } from '@/app/canvas/types';
import { validateTriggerConfig, getDefaultTriggerConfig } from '../lib/validation';
import type { TriggerValidationResult } from '../types';

export interface UseMasterTriggerResult {
  /** Update trigger node configuration */
  updateTriggerConfig: (
    nodeId: NodeId,
    config: Partial<MasterTriggerNodeConfig>
  ) => Promise<boolean>;

  /** Toggle exposure status */
  toggleExposure: (nodeId: NodeId, isExposed: boolean) => Promise<boolean>;

  /** Validate trigger configuration */
  validateConfig: (config: Partial<MasterTriggerNodeConfig>) => TriggerValidationResult;

  /** Get default configuration */
  getDefaultConfig: () => MasterTriggerNodeConfig;

  /** Check if a node has valid connections for execution */
  hasValidConnections: (
    nodeId: NodeId,
    nodes: CanvasNode[],
    edges: Array<{ from_node_id: NodeId; to_node_id: NodeId }>
  ) => boolean;

  /** Get connected Genesis Bot nodes */
  getConnectedBots: (
    nodeId: NodeId,
    nodes: CanvasNode[],
    edges: Array<{ from_node_id: NodeId; to_node_id: NodeId }>
  ) => CanvasNode[];

  /** Loading state */
  loading: boolean;

  /** Error state */
  error: string | null;
}

export function useMasterTrigger(canvasId: CanvasId | null): UseMasterTriggerResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Update trigger node configuration
   */
  const updateTriggerConfig = useCallback(
    async (nodeId: NodeId, configUpdates: Partial<MasterTriggerNodeConfig>): Promise<boolean> => {
      if (!canvasId || !nodeId) {
        setError('Canvas ID and Node ID are required');
        return false;
      }

      setLoading(true);
      setError(null);

      try {
        // First, fetch current config
        const { data: currentNode, error: fetchError } = await supabase
          .from('canvas_nodes')
          .select('config')
          .eq('id', nodeId)
          .eq('canvas_id', canvasId)
          .single();

        if (fetchError) throw fetchError;

        // Merge with updates
        const newConfig = {
          ...currentNode.config,
          ...configUpdates,
        };

        // Validate the new config
        const validation = validateTriggerConfig(newConfig);
        if (!validation.isValid) {
          setError(validation.errors.join(', '));
          return false;
        }

        // Update in database
        const { error: updateError } = await supabase
          .from('canvas_nodes')
          .update({
            config: newConfig,
            updated_at: new Date().toISOString(),
          })
          .eq('id', nodeId)
          .eq('canvas_id', canvasId);

        if (updateError) throw updateError;

        console.log('[useMasterTrigger] Config updated:', nodeId);
        return true;
      } catch (err: any) {
        console.error('[useMasterTrigger] Error updating config:', err);
        setError(err.message || 'Failed to update trigger configuration');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [canvasId]
  );

  /**
   * Toggle exposure status
   */
  const toggleExposure = useCallback(
    async (nodeId: NodeId, isExposed: boolean): Promise<boolean> => {
      return updateTriggerConfig(nodeId, { is_exposed: isExposed });
    },
    [updateTriggerConfig]
  );

  /**
   * Validate trigger configuration
   */
  const validateConfig = useCallback(
    (config: Partial<MasterTriggerNodeConfig>): TriggerValidationResult => {
      return validateTriggerConfig(config);
    },
    []
  );

  /**
   * Get default configuration
   */
  const getDefaultConfig = useCallback((): MasterTriggerNodeConfig => {
    return getDefaultTriggerConfig();
  }, []);

  /**
   * Check if a trigger node has valid connections for execution
   * (Must be connected to at least one Genesis Bot node)
   */
  const hasValidConnections = useCallback(
    (
      nodeId: NodeId,
      nodes: CanvasNode[],
      edges: Array<{ from_node_id: NodeId; to_node_id: NodeId }>
    ): boolean => {
      // Find edges going out from this trigger node
      const outgoingEdges = edges.filter((edge) => edge.from_node_id === nodeId);

      if (outgoingEdges.length === 0) {
        return false;
      }

      // Check if any connected node is a Genesis Bot
      return outgoingEdges.some((edge) => {
        const targetNode = nodes.find((n) => n.id === edge.to_node_id);
        return targetNode?.type === 'GENESIS_BOT';
      });
    },
    []
  );

  /**
   * Get all Genesis Bot nodes connected to this trigger
   */
  const getConnectedBots = useCallback(
    (
      nodeId: NodeId,
      nodes: CanvasNode[],
      edges: Array<{ from_node_id: NodeId; to_node_id: NodeId }>
    ): CanvasNode[] => {
      // Find edges going out from this trigger node
      const outgoingEdges = edges.filter((edge) => edge.from_node_id === nodeId);

      // Get connected Genesis Bot nodes
      return outgoingEdges
        .map((edge) => nodes.find((n) => n.id === edge.to_node_id))
        .filter((node): node is CanvasNode => node?.type === 'GENESIS_BOT');
    },
    []
  );

  return {
    updateTriggerConfig,
    toggleExposure,
    validateConfig,
    getDefaultConfig,
    hasValidConnections,
    getConnectedBots,
    loading,
    error,
  };
}
