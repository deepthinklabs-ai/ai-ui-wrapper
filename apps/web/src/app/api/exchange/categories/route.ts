/**
 * Exchange Categories API
 *
 * GET /api/exchange/categories - List all categories
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
  try {
    // Initialize Supabase client (server-side with service role key)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch all categories ordered by sort_order
    const { data: categories, error } = await supabase
      .from('exchange_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[GET /api/exchange/categories] Database error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch categories' },
        { status: 500 }
      );
    }

    return NextResponse.json({ categories });
  } catch (error: any) {
    console.error('[GET /api/exchange/categories] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
