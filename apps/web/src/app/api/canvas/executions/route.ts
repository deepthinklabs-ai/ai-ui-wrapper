/**
 * GET /api/canvas/executions
 *
 * Fetches workflow executions for a canvas.
 * Used by the Executions tab to display execution history.
 *
 * Requires authentication - user must own the canvas.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { withDebug } from '@/lib/debug';

// Lazy-initialized Supabase client with service role for admin operations
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabase;
}

export const GET = withDebug(async (request, sessionId) => {
  try {
    // Authenticate the user
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

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

    const supabase = getSupabase();

    // Verify user owns this canvas
    const { data: canvas, error: canvasError } = await supabase
      .from('canvases')
      .select('id')
      .eq('id', canvasId)
      .eq('user_id', user.id)
      .single();

    if (canvasError || !canvas) {
      return NextResponse.json(
        { error: 'Canvas not found or access denied' },
        { status: 403 }
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
});

/**
 * POST /api/canvas/executions
 *
 * Fetch a single execution by ID.
 * Uses POST to pass executionId in body.
 *
 * Requires authentication - user must own the canvas.
 */
export const POST = withDebug(async (request, sessionId) => {
  try {
    // Authenticate the user
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json(
        { error: authError || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { executionId } = body;

    if (!executionId) {
      return NextResponse.json(
        { error: 'executionId is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Fetch execution with canvas ownership verification
    const { data: execution, error } = await supabase
      .from('workflow_executions')
      .select('*, canvases!inner(user_id)')
      .eq('id', executionId)
      .single();

    if (error || !execution) {
      console.error('[POST /api/canvas/executions] Error:', error);
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if ((execution as any).canvases?.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Remove the joined canvases data before returning
    const { canvases: _, ...executionData } = execution as any;

    return NextResponse.json({ execution: executionData });
  } catch (error: any) {
    console.error('[POST /api/canvas/executions] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
});
