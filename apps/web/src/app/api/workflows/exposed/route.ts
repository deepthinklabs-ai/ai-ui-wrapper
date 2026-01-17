/**
 * GET /api/workflows/exposed
 *
 * Returns all workflows that have exposed Master Trigger nodes.
 * These workflows will be available in the Genesis Bot page dropdown.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ExposedWorkflow } from '@/app/canvas/features/master-trigger/types';
import { withDebug } from '@/lib/debug';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const GET = withDebug(async (request, sessionId) => {
  try {
    // Get userId from query params or auth header
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    // Query all canvases belonging to the user
    const { data: canvases, error: canvasError } = await supabase
      .from('canvases')
      .select('id, name')
      .eq('user_id', userId);

    if (canvasError) {
      console.error('[GET /api/workflows/exposed] Canvas query error:', canvasError);
      return NextResponse.json(
        { error: 'Failed to fetch canvases' },
        { status: 500 }
      );
    }

    if (!canvases || canvases.length === 0) {
      return NextResponse.json({ workflows: [] });
    }

    const canvasIds = canvases.map((c) => c.id);

    // Query all MASTER_TRIGGER nodes that are exposed
    // Use the is_exposed column (unencrypted) for efficient querying
    const { data: triggerNodes, error: nodeError } = await supabase
      .from('canvas_nodes')
      .select('id, canvas_id, config, is_exposed')
      .eq('type', 'MASTER_TRIGGER')
      .eq('is_exposed', true)
      .in('canvas_id', canvasIds);

    if (nodeError) {
      console.error('[GET /api/workflows/exposed] Node query error:', nodeError);
      return NextResponse.json(
        { error: 'Failed to fetch trigger nodes' },
        { status: 500 }
      );
    }

    // Map to ExposedWorkflow format
    // Note: config may be encrypted, so we check both the column and config fallback
    const exposedWorkflows: ExposedWorkflow[] = [];

    for (const node of triggerNodes || []) {
      const canvas = canvases.find((c) => c.id === node.canvas_id);

      // Try to get display info from config (may be encrypted)
      let displayName = 'Unnamed Workflow';
      let description: string | undefined;
      let lastTriggeredAt: string | undefined;
      let triggerCount: number | undefined;

      // If config is an object (not encrypted), read from it
      if (node.config && typeof node.config === 'object' && !Array.isArray(node.config)) {
        const config = node.config as {
          display_name?: string;
          description?: string;
          last_triggered_at?: string;
          trigger_count?: number;
        };
        // Use display_name if set, otherwise fall back to canvas name
        displayName = config.display_name || canvas?.name || displayName;
        description = config.description;
        lastTriggeredAt = config.last_triggered_at;
        triggerCount = config.trigger_count;
      } else {
        // Config is encrypted or missing - use canvas name as fallback
        displayName = canvas?.name || displayName;
      }

      exposedWorkflows.push({
        canvasId: node.canvas_id,
        canvasName: canvas?.name || 'Unknown Canvas',
        triggerNodeId: node.id,
        displayName,
        description,
        lastTriggeredAt,
        triggerCount,
      });
    }

    // Sort by display name
    exposedWorkflows.sort((a, b) => a.displayName.localeCompare(b.displayName));

    console.log(`[GET /api/workflows/exposed] Found ${exposedWorkflows.length} exposed workflows for user ${userId}`);
    console.log(`[GET /api/workflows/exposed] Canvas IDs searched: ${canvasIds.join(', ')}`);
    console.log(`[GET /api/workflows/exposed] Trigger nodes found: ${triggerNodes?.length || 0}`);

    return NextResponse.json({ workflows: exposedWorkflows });
  } catch (error: any) {
    console.error('[GET /api/workflows/exposed] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
});
