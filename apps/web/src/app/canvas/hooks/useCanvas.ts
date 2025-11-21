/**
 * useCanvas Hook
 *
 * Manages Canvas CRUD operations:
 * - List user's canvases
 * - Create new canvas
 * - Update canvas
 * - Delete canvas
 * - Select current canvas
 */

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import type { Canvas, CanvasId, CreateCanvasInput, UseCanvasResult } from '../types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function useCanvas(userId: string | undefined): UseCanvasResult {
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [currentCanvas, setCurrentCanvas] = useState<Canvas | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch canvases on mount and when userId changes
  useEffect(() => {
    if (!userId) return;
    refreshCanvases();
  }, [userId]);

  /**
   * Fetch all canvases for the current user
   */
  const refreshCanvases = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('canvases')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (fetchError) throw fetchError;

      setCanvases(data || []);

      // Auto-select first canvas if none selected
      if (!currentCanvas && data && data.length > 0) {
        setCurrentCanvas(data[0]);
      }
    } catch (err: any) {
      console.error('[useCanvas] Error fetching canvases:', err);
      setError(err.message || 'Failed to load canvases');
    } finally {
      setLoading(false);
    }
  }, [userId, currentCanvas]);

  /**
   * Create a new canvas
   */
  const createCanvas = useCallback(
    async (input: CreateCanvasInput): Promise<Canvas | null> => {
      if (!userId) {
        setError('User not authenticated');
        return null;
      }

      setLoading(true);
      setError(null);

      try {
        const newCanvas = {
          user_id: userId,
          name: input.name,
          description: input.description,
          mode: input.mode,
          is_template: false,
        };

        const { data, error: insertError } = await supabase
          .from('canvases')
          .insert(newCanvas)
          .select()
          .single();

        if (insertError) throw insertError;

        // Add to local state
        setCanvases(prev => [data, ...prev]);
        setCurrentCanvas(data);

        // If starting from a template, clone nodes and edges
        if (input.template_id) {
          await cloneTemplate(input.template_id, data.id);
        }

        return data;
      } catch (err: any) {
        console.error('[useCanvas] Error creating canvas:', err);
        setError(err.message || 'Failed to create canvas');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [userId]
  );

  /**
   * Update an existing canvas
   */
  const updateCanvas = useCallback(
    async (id: CanvasId, updates: Partial<Canvas>): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const { error: updateError } = await supabase
          .from('canvases')
          .update(updates)
          .eq('id', id)
          .eq('user_id', userId);

        if (updateError) throw updateError;

        // Update local state
        setCanvases(prev =>
          prev.map(canvas =>
            canvas.id === id ? { ...canvas, ...updates } : canvas
          )
        );

        if (currentCanvas?.id === id) {
          setCurrentCanvas(prev => (prev ? { ...prev, ...updates } : null));
        }

        return true;
      } catch (err: any) {
        console.error('[useCanvas] Error updating canvas:', err);
        setError(err.message || 'Failed to update canvas');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [userId, currentCanvas]
  );

  /**
   * Delete a canvas
   */
  const deleteCanvas = useCallback(
    async (id: CanvasId): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const { error: deleteError } = await supabase
          .from('canvases')
          .delete()
          .eq('id', id)
          .eq('user_id', userId);

        if (deleteError) throw deleteError;

        // Remove from local state
        setCanvases(prev => prev.filter(canvas => canvas.id !== id));

        // Clear current canvas if it was deleted
        if (currentCanvas?.id === id) {
          const remaining = canvases.filter(c => c.id !== id);
          setCurrentCanvas(remaining.length > 0 ? remaining[0] : null);
        }

        return true;
      } catch (err: any) {
        console.error('[useCanvas] Error deleting canvas:', err);
        setError(err.message || 'Failed to delete canvas');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [userId, currentCanvas, canvases]
  );

  /**
   * Select a canvas as the current one
   */
  const selectCanvas = useCallback((canvas: Canvas | null) => {
    setCurrentCanvas(canvas);
  }, []);

  /**
   * Clone a template to a new canvas (helper function)
   */
  const cloneTemplate = async (templateId: string, canvasId: CanvasId) => {
    try {
      // Fetch template data
      const { data: template, error: templateError } = await supabase
        .from('canvas_templates')
        .select('template_data')
        .eq('id', templateId)
        .single();

      if (templateError) throw templateError;

      const { nodes, edges } = template.template_data;

      // Clone nodes
      if (nodes && nodes.length > 0) {
        const nodesToInsert = nodes.map((node: any) => ({
          ...node,
          id: undefined, // Let DB generate new IDs
          canvas_id: canvasId,
        }));

        await supabase.from('canvas_nodes').insert(nodesToInsert);
      }

      // Clone edges (would need to map old node IDs to new ones)
      // TODO: Implement proper ID mapping for edges
      console.log('[useCanvas] Template cloned, edges mapping pending');
    } catch (err) {
      console.error('[useCanvas] Error cloning template:', err);
    }
  };

  return {
    canvases,
    currentCanvas,
    loading,
    error,
    createCanvas,
    updateCanvas,
    deleteCanvas,
    selectCanvas,
    refreshCanvases,
  };
}
