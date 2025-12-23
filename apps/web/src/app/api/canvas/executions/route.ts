/**
 * GET /api/canvas/executions
 *
 * Fetches workflow executions for a canvas.
 * Used by the Executions tab to display execution history.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const canvasId = searchParams.get('canvasId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    if (!canvasId) {
      return NextResponse.json(
        { error: 'canvasId is required' },
        { status: 400 }
      );
    }

    // Fetch executions for this canvas
    const { data: executions, error, count } = await supabase
      .from('workflow_executions')
      .select('*', { count: 'exact' })
      .eq('canvas_id', canvasId)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[GET /api/canvas/executions] Error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch executions' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      executions: executions || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error('[GET /api/canvas/executions] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/canvas/executions/[id]
 *
 * Fetch a single execution by ID.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { executionId } = body;

    if (!executionId) {
      return NextResponse.json(
        { error: 'executionId is required' },
        { status: 400 }
      );
    }

    const { data: execution, error } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('id', executionId)
      .single();

    if (error) {
      console.error('[POST /api/canvas/executions] Error:', error);
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ execution });
  } catch (error: any) {
    console.error('[POST /api/canvas/executions] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
