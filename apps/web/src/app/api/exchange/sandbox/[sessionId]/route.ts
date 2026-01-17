/**
 * Exchange Sandbox Session API
 *
 * GET /api/exchange/sandbox/[sessionId] - Get session with messages
 * DELETE /api/exchange/sandbox/[sessionId] - End/delete session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withDebug } from '@/lib/debug';

type RouteParams = { params: Promise<{ sessionId: string }> };

/**
 * GET - Get session with messages
 */
export const GET = withDebug(async (req, sessionId, { params }: RouteParams) => {
  try {
    const { sessionId } = await params;

    // Get authenticated user
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch session
    const { data: session, error: sessionError } = await supabase
      .from('exchange_sandbox_sessions')
      .select('*')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      // Clean up expired session
      await supabase
        .from('exchange_sandbox_sessions')
        .delete()
        .eq('id', sessionId);

      return NextResponse.json(
        { error: 'Session has expired' },
        { status: 410 }
      );
    }

    // Fetch the associated post for chatbot config
    const { data: post } = await supabase
      .from('exchange_posts')
      .select('id, title, chatbot_file, canvas_file')
      .eq('id', session.post_id)
      .single();

    return NextResponse.json({
      session: {
        id: session.id,
        post_id: session.post_id,
        messages: session.messages || [],
        last_query_at: session.last_query_at,
        created_at: session.created_at,
        expires_at: session.expires_at,
      },
      post: post ? {
        id: post.id,
        title: post.title,
        chatbot_config: post.chatbot_file?.config,
        has_canvas: !!post.canvas_file,
        oauth_requirements: post.chatbot_file?.config?.oauth_requirements ||
                           post.canvas_file?.oauth_requirements,
      } : null,
    });
  } catch (error: any) {
    console.error('[GET /api/exchange/sandbox/[sessionId]] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * DELETE - End/delete session
 */
export const DELETE = withDebug(async (req, sessionId, { params }: RouteParams) => {
  try {
    const { sessionId } = await params;

    // Get authenticated user
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Delete session (only if owned by user)
    const { error: deleteError } = await supabase
      .from('exchange_sandbox_sessions')
      .delete()
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (deleteError) {
      console.error('[DELETE /api/exchange/sandbox/[sessionId]] Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete session' },
        { status: 500 }
      );
    }

    console.log(`[DELETE /api/exchange/sandbox/[sessionId]] Deleted session ${sessionId}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /api/exchange/sandbox/[sessionId]] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
});
