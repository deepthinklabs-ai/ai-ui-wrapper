/**
 * useCanvasNodes Hook
 *
 * Manages nodes within a canvas:
 * - Add node
 * - Update node (position, config, label)
 * - Delete node
 * - Duplicate node
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type {
  CanvasNode,
  CanvasNodeType,
  NodeId,
  CanvasId,
  UseCanvasNodesResult,
} from '../types';
import { createDefaultNode } from '../lib/nodeRegistry';

export function useCanvasNodes(canvasId: CanvasId | null): UseCanvasNodesResult {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [loading, setLoading] = useState(false);

  // Phase 2: Race condition prevention - track current canvas request
  const currentCanvasIdRef = useRef<CanvasId | null>(null);

  // Fetch nodes when canvas changes
  useEffect(() => {
    if (!canvasId) {
      setNodes([]);
      currentCanvasIdRef.current = null;
      return;
    }
    currentCanvasIdRef.current = canvasId;
    refreshNodes();
  }, [canvasId]);

  /**
   * Fetch all nodes for the current canvas (with race condition prevention)
   */
  const refreshNodes = useCallback(async () => {
    if (!canvasId) return;

    // Store the canvas ID we're fetching for
    const fetchingForCanvasId = canvasId;

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('canvas_nodes')
        .select('*')
        .eq('canvas_id', canvasId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // CRITICAL: Check if canvas changed while fetching (race condition prevention)
      if (currentCanvasIdRef.current !== fetchingForCanvasId) {
        console.log('[useCanvasNodes] Canvas changed during fetch, discarding stale data');
        return;
      }

      // Transform DB format to CanvasNode format
      const transformedNodes: CanvasNode[] = (data || []).map(node => ({
        id: node.id,
        canvas_id: node.canvas_id,
        type: node.type,
        position: { x: node.position_x, y: node.position_y },
        label: node.label,
        config: node.config,
        is_exposed: node.is_exposed,
        created_at: node.created_at,
        updated_at: node.updated_at,
      }));

      setNodes(transformedNodes);
    } catch (err) {
      console.error('[useCanvasNodes] Error fetching nodes:', err);
    } finally {
      setLoading(false);
    }
  }, [canvasId]);

  /**
   * Add a new node to the canvas
   */
  const addNode = useCallback(
    async (
      type: CanvasNodeType,
      position: { x: number; y: number },
      config?: any
    ): Promise<CanvasNode | null> => {
      if (!canvasId) return null;

      setLoading(true);

      try {
        // Get default node configuration
        const defaultNode = createDefaultNode(type, position);
        const finalConfig = config || defaultNode.config;

        // Build the new node object
        const newNode: Record<string, any> = {
          canvas_id: canvasId,
          type,
          position_x: position.x,
          position_y: position.y,
          label: defaultNode.label,
          config: finalConfig,
        };

        // Set is_exposed column from config for MASTER_TRIGGER nodes
        if (finalConfig && typeof finalConfig === 'object' && 'is_exposed' in finalConfig) {
          newNode.is_exposed = finalConfig.is_exposed;
        }

        // Set runtime_config for GENESIS_BOT nodes (stores non-sensitive fields unencrypted)
        if (finalConfig && typeof finalConfig === 'object') {
          if (finalConfig.model_provider || finalConfig.model_name || finalConfig.system_prompt !== undefined) {
            newNode.runtime_config = {
              name: finalConfig.name,
              model_provider: finalConfig.model_provider,
              model_name: finalConfig.model_name,
              gmail_enabled: finalConfig.gmail?.enabled || false,
              calendar_enabled: finalConfig.calendar?.enabled || false,
              sheets_enabled: finalConfig.sheets?.enabled || false,
              docs_enabled: finalConfig.docs?.enabled || false,
              slack_enabled: finalConfig.slack?.enabled || false,
            };
          }
        }

        const { data, error } = await supabase
          .from('canvas_nodes')
          .insert(newNode)
          .select()
          .single();

        if (error) throw error;

        // Transform and add to local state
        const transformedNode: CanvasNode = {
          id: data.id,
          canvas_id: data.canvas_id,
          type: data.type,
          position: { x: data.position_x, y: data.position_y },
          label: data.label,
          config: data.config,
          is_exposed: data.is_exposed,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };

        setNodes(prev => [...prev, transformedNode]);

        return transformedNode;
      } catch (err: any) {
        console.error('[useCanvasNodes] Error adding node:', err?.message || err?.code || JSON.stringify(err));
        console.error('[useCanvasNodes] Full error:', JSON.stringify(err, null, 2));
        return null;
      } finally {
        setLoading(false);
      }
    },
    [canvasId]
  );

  /**
   * Update an existing node
   */
  const updateNode = useCallback(
    async (id: NodeId, updates: Partial<CanvasNode>): Promise<boolean> => {
      if (!canvasId) return false;

      console.log('[useCanvasNodes] updateNode called:', { id, updates });

      setLoading(true);

      try {
        // Transform position if updated
        const dbUpdates: any = { ...updates };
        if (updates.position) {
          dbUpdates.position_x = updates.position.x;
          dbUpdates.position_y = updates.position.y;
          delete dbUpdates.position;
        }

        // IMPORTANT: Sync is_exposed from config to column for MASTER_TRIGGER nodes
        // This allows the API to query exposed workflows without decrypting config
        if (updates.config && typeof updates.config === 'object' && 'is_exposed' in updates.config) {
          dbUpdates.is_exposed = (updates.config as any).is_exposed;
        }

        // IMPORTANT: Sync runtime_config for GENESIS_BOT nodes
        // This stores non-sensitive config fields unencrypted for server-side workflow access
        // (model_provider, model_name, integration flags) - the main config may be encrypted
        if (updates.config && typeof updates.config === 'object') {
          const config = updates.config as any;
          // Check if this looks like a GenesisBotNodeConfig
          if (config.model_provider || config.model_name || config.system_prompt !== undefined) {
            dbUpdates.runtime_config = {
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
        }

        // Remove fields that shouldn't be updated
        delete dbUpdates.id;
        delete dbUpdates.canvas_id;
        delete dbUpdates.created_at;
        delete dbUpdates.updated_at;

        console.log('[useCanvasNodes] Sending to Supabase:', dbUpdates);

        const { error } = await supabase
          .from('canvas_nodes')
          .update(dbUpdates)
          .eq('id', id)
          .eq('canvas_id', canvasId);

        if (error) {
          console.error('[useCanvasNodes] Supabase error:', error);
          throw error;
        }

        console.log('[useCanvasNodes] Supabase update successful');

        // Update local state
        setNodes(prev =>
          prev.map(node =>
            node.id === id ? { ...node, ...updates } : node
          )
        );

        return true;
      } catch (err) {
        console.error('[useCanvasNodes] Error updating node:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [canvasId]
  );

  /**
   * Delete a node (with cascade delete for connected edges)
   */
  const deleteNode = useCallback(
    async (id: NodeId): Promise<boolean> => {
      if (!canvasId) return false;

      setLoading(true);

      try {
        // CRITICAL: Delete connected edges FIRST (cascade delete)
        // Delete edges where this node is the source
        const { error: edgeSourceError } = await supabase
          .from('canvas_edges')
          .delete()
          .eq('from_node_id', id);

        if (edgeSourceError) {
          console.error('[useCanvasNodes] Error deleting source edges:', edgeSourceError);
          throw edgeSourceError;
        }

        // Delete edges where this node is the target
        const { error: edgeTargetError } = await supabase
          .from('canvas_edges')
          .delete()
          .eq('to_node_id', id);

        if (edgeTargetError) {
          console.error('[useCanvasNodes] Error deleting target edges:', edgeTargetError);
          throw edgeTargetError;
        }

        // Now delete the node itself
        const { error } = await supabase
          .from('canvas_nodes')
          .delete()
          .eq('id', id)
          .eq('canvas_id', canvasId);

        if (error) throw error;

        // Remove from local state
        setNodes(prev => prev.filter(node => node.id !== id));

        console.log(`[useCanvasNodes] Deleted node ${id} and all connected edges`);

        return true;
      } catch (err) {
        console.error('[useCanvasNodes] Error deleting node:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [canvasId]
  );

  /**
   * Duplicate a node
   */
  const duplicateNode = useCallback(
    async (id: NodeId): Promise<CanvasNode | null> => {
      if (!canvasId) return null;

      const originalNode = nodes.find(n => n.id === id);
      if (!originalNode) return null;

      // Create duplicate with offset position
      return addNode(
        originalNode.type,
        {
          x: originalNode.position.x + 50,
          y: originalNode.position.y + 50,
        },
        { ...originalNode.config }
      );
    },
    [canvasId, nodes, addNode]
  );

  return {
    nodes,
    loading,
    addNode,
    updateNode,
    deleteNode,
    duplicateNode,
    refreshNodes,
  };
}
