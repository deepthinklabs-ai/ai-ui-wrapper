/**
 * useCanvasNodes Hook
 *
 * Manages nodes within a canvas:
 * - Add node
 * - Update node (position, config, label)
 * - Delete node
 * - Duplicate node
 */

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import type {
  CanvasNode,
  CanvasNodeType,
  NodeId,
  CanvasId,
  UseCanvasNodesResult,
} from '../types';
import { createDefaultNode } from '../lib/nodeRegistry';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function useCanvasNodes(canvasId: CanvasId | null): UseCanvasNodesResult {
  const [nodes, setNodes] = useState<CanvasNode[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch nodes when canvas changes
  useEffect(() => {
    if (!canvasId) {
      setNodes([]);
      return;
    }
    refreshNodes();
  }, [canvasId]);

  /**
   * Fetch all nodes for the current canvas
   */
  const refreshNodes = useCallback(async () => {
    if (!canvasId) return;

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('canvas_nodes')
        .select('*')
        .eq('canvas_id', canvasId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Transform DB format to CanvasNode format
      const transformedNodes: CanvasNode[] = (data || []).map(node => ({
        id: node.id,
        canvas_id: node.canvas_id,
        type: node.type,
        position: { x: node.position_x, y: node.position_y },
        label: node.label,
        config: node.config,
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

        const newNode = {
          canvas_id: canvasId,
          type,
          position_x: position.x,
          position_y: position.y,
          label: defaultNode.label,
          config: config || defaultNode.config,
        };

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
          created_at: data.created_at,
          updated_at: data.updated_at,
        };

        setNodes(prev => [...prev, transformedNode]);

        return transformedNode;
      } catch (err) {
        console.error('[useCanvasNodes] Error adding node:', err);
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

      setLoading(true);

      try {
        // Transform position if updated
        const dbUpdates: any = { ...updates };
        if (updates.position) {
          dbUpdates.position_x = updates.position.x;
          dbUpdates.position_y = updates.position.y;
          delete dbUpdates.position;
        }

        // Remove fields that shouldn't be updated
        delete dbUpdates.id;
        delete dbUpdates.canvas_id;
        delete dbUpdates.created_at;
        delete dbUpdates.updated_at;

        const { error } = await supabase
          .from('canvas_nodes')
          .update(dbUpdates)
          .eq('id', id)
          .eq('canvas_id', canvasId);

        if (error) throw error;

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
   * Delete a node
   */
  const deleteNode = useCallback(
    async (id: NodeId): Promise<boolean> => {
      if (!canvasId) return false;

      setLoading(true);

      try {
        const { error } = await supabase
          .from('canvas_nodes')
          .delete()
          .eq('id', id)
          .eq('canvas_id', canvasId);

        if (error) throw error;

        // Remove from local state
        setNodes(prev => prev.filter(node => node.id !== id));

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
