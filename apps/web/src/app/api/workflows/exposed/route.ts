/**
 * GET /api/workflows/exposed
 *
 * Returns all workflows that have exposed Master Trigger nodes.
 * These workflows will be available in the Genesis Bot page dropdown.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ExposedWorkflow } from '@/app/canvas/features/master-trigger/types';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
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
    const { data: triggerNodes, error: nodeError } = await supabase
      .from('canvas_nodes')
      .select('id, canvas_id, config')
      .eq('type', 'MASTER_TRIGGER')
      .in('canvas_id', canvasIds);

    if (nodeError) {
      console.error('[GET /api/workflows/exposed] Node query error:', nodeError);
      return NextResponse.json(
        { error: 'Failed to fetch trigger nodes' },
        { status: 500 }
      );
    }

    // Filter to only exposed triggers and map to ExposedWorkflow format
    const exposedWorkflows: ExposedWorkflow[] = [];

    for (const node of triggerNodes || []) {
      const config = node.config as {
        display_name?: string;
        description?: string;
        is_exposed?: boolean;
        last_triggered_at?: string;
        trigger_count?: number;
      };

      if (config?.is_exposed) {
        const canvas = canvases.find((c) => c.id === node.canvas_id);

        exposedWorkflows.push({
          canvasId: node.canvas_id,
          canvasName: canvas?.name || 'Unknown Canvas',
          triggerNodeId: node.id,
          displayName: config.display_name || 'Unnamed Workflow',
          description: config.description,
          lastTriggeredAt: config.last_triggered_at,
          triggerCount: config.trigger_count,
        });
      }
    }

    // Sort by display name
    exposedWorkflows.sort((a, b) => a.displayName.localeCompare(b.displayName));

    console.log(`[GET /api/workflows/exposed] Found ${exposedWorkflows.length} exposed workflows for user ${userId}`);

    return NextResponse.json({ workflows: exposedWorkflows });
  } catch (error: any) {
    console.error('[GET /api/workflows/exposed] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
