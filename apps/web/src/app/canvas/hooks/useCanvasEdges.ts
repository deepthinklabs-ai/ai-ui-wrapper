/**
 * useCanvasEdges Hook
 *
 * Manages edges (connections) between nodes:
 * - Add edge
 * - Update edge
 * - Delete edge
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type {
  CanvasEdge,
  EdgeId,
  NodeId,
  CanvasId,
  UseCanvasEdgesResult,
} from '../types';

export function useCanvasEdges(canvasId: CanvasId | null): UseCanvasEdgesResult {
  const [edges, setEdges] = useState<CanvasEdge[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch edges when canvas changes
  useEffect(() => {
    if (!canvasId) {
      setEdges([]);
      return;
    }
    refreshEdges();
  }, [canvasId]);

  /**
   * Fetch all edges for the current canvas
   */
  const refreshEdges = useCallback(async () => {
    if (!canvasId) return;

    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('canvas_edges')
        .select('*')
        .eq('canvas_id', canvasId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      setEdges(data || []);
    } catch (err) {
      console.error('[useCanvasEdges] Error fetching edges:', err);
    } finally {
      setLoading(false);
    }
  }, [canvasId]);

  /**
   * Add a new edge between two nodes
   */
  const addEdge = useCallback(
    async (
      from: NodeId,
      to: NodeId,
      config?: Partial<CanvasEdge>
    ): Promise<CanvasEdge | null> => {
      if (!canvasId) return null;

      setLoading(true);

      try {
        // Check if edge already exists (prevent duplicates)
        const existingEdge = edges.find(
          e =>
            e.from_node_id === from &&
            e.to_node_id === to &&
            e.from_port === config?.from_port &&
            e.to_port === config?.to_port
        );

        if (existingEdge) {
          console.warn('[useCanvasEdges] Edge already exists - duplicate prevention');
          // Return null to signal duplicate (caller should show user feedback)
          return null;
        }

        const newEdge = {
          canvas_id: canvasId,
          from_node_id: from,
          to_node_id: to,
          from_port: config?.from_port,
          to_port: config?.to_port,
          label: config?.label,
          animated: config?.animated || false,
          condition: config?.condition,
          transform: config?.transform,
          metadata: config?.metadata || {},
        };

        const { data, error } = await supabase
          .from('canvas_edges')
          .insert(newEdge)
          .select()
          .single();

        if (error) throw error;

        setEdges(prev => [...prev, data]);

        return data;
      } catch (err) {
        console.error('[useCanvasEdges] Error adding edge:', err);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [canvasId, edges]
  );

  /**
   * Update an existing edge
   */
  const updateEdge = useCallback(
    async (id: EdgeId, updates: Partial<CanvasEdge>): Promise<boolean> => {
      if (!canvasId) return false;

      setLoading(true);

      try {
        // Remove fields that shouldn't be updated
        const cleanUpdates = { ...updates };
        delete (cleanUpdates as any).id;
        delete (cleanUpdates as any).canvas_id;
        delete (cleanUpdates as any).created_at;

        const { error } = await supabase
          .from('canvas_edges')
          .update(cleanUpdates)
          .eq('id', id)
          .eq('canvas_id', canvasId);

        if (error) throw error;

        // Update local state
        setEdges(prev =>
          prev.map(edge =>
            edge.id === id ? { ...edge, ...updates } : edge
          )
        );

        return true;
      } catch (err) {
        console.error('[useCanvasEdges] Error updating edge:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [canvasId]
  );

  /**
   * Delete an edge
   */
  const deleteEdge = useCallback(
    async (id: EdgeId): Promise<boolean> => {
      if (!canvasId) return false;

      setLoading(true);

      try {
        const { error } = await supabase
          .from('canvas_edges')
          .delete()
          .eq('id', id)
          .eq('canvas_id', canvasId);

        if (error) throw error;

        // Remove from local state
        setEdges(prev => prev.filter(edge => edge.id !== id));

        return true;
      } catch (err) {
        console.error('[useCanvasEdges] Error deleting edge:', err);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [canvasId]
  );

  return {
    edges,
    loading,
    addEdge,
    updateEdge,
    deleteEdge,
    refreshEdges,
  };
}
