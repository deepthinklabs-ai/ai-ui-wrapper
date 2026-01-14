/**
 * Exchange Tags API
 *
 * GET /api/exchange/tags - Search/list tags
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withDebug } from '@/lib/debug';

export const GET = withDebug(async (req, sessionId) => {
  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Initialize Supabase client (server-side with service role key)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Build query
    let query = supabase
      .from('exchange_tags')
      .select('*')
      .order('use_count', { ascending: false })
      .limit(limit);

    // Add search filter if provided
    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    const { data: tags, error } = await query;

    if (error) {
      console.error('[GET /api/exchange/tags] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch tags' },
        { status: 500 }
      );
    }

    return NextResponse.json({ tags });
  } catch (error: any) {
    console.error('[GET /api/exchange/tags] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
});
