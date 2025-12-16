/**
 * Exchange Sandbox API
 *
 * POST /api/exchange/sandbox - Create a new sandbox session
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { post_id } = body;

    if (!post_id) {
      return NextResponse.json(
        { error: 'Post ID is required' },
        { status: 400 }
      );
    }

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

    // Verify user tier
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const userTier = profile.tier as string;
    if (userTier === 'expired' || userTier === 'pending') {
      return NextResponse.json(
        { error: 'Active subscription required to test chatbots' },
        { status: 403 }
      );
    }

    // Verify post exists and is published
    const { data: post, error: postError } = await supabase
      .from('exchange_posts')
      .select('id, title, chatbot_file')
      .eq('id', post_id)
      .eq('is_published', true)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    if (!post.chatbot_file) {
      return NextResponse.json(
        { error: 'This post does not contain a chatbot to test' },
        { status: 400 }
      );
    }

    // Check for existing active session for this user and post
    const { data: existingSession } = await supabase
      .from('exchange_sandbox_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('post_id', post_id)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (existingSession) {
      // Return existing session
      return NextResponse.json({
        success: true,
        session_id: existingSession.id,
        existing: true,
      });
    }

    // Create new sandbox session
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

    const { data: session, error: sessionError } = await supabase
      .from('exchange_sandbox_sessions')
      .insert({
        post_id,
        user_id: userId,
        messages: [],
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (sessionError) {
      console.error('[POST /api/exchange/sandbox] Session create error:', sessionError);
      return NextResponse.json(
        { error: 'Failed to create sandbox session' },
        { status: 500 }
      );
    }

    console.log(`[POST /api/exchange/sandbox] Created session ${session.id} for user ${userId} on post ${post_id}`);

    return NextResponse.json({
      success: true,
      session_id: session.id,
      existing: false,
    });
  } catch (error: any) {
    console.error('[POST /api/exchange/sandbox] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
