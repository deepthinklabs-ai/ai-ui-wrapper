/**
 * Exchange Posts API
 *
 * GET /api/exchange/posts - List posts with filters
 * POST /api/exchange/posts - Create a new post
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type {
  CreateExchangePostRequest,
  ListExchangePostsFilter,
  ExchangePostPreview,
} from '@/app/exchange/types';

/**
 * GET - List posts with optional filters
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Parse filter parameters
    const filter: ListExchangePostsFilter = {
      category_ids: searchParams.get('category_ids')?.split(',').filter(Boolean),
      tag_names: searchParams.get('tag_names')?.split(',').filter(Boolean),
      search: searchParams.get('search') || undefined,
      user_id: searchParams.get('user_id') || undefined,
      sort_by: (searchParams.get('sort_by') as ListExchangePostsFilter['sort_by']) || 'created_at',
      sort_order: (searchParams.get('sort_order') as 'asc' | 'desc') || 'desc',
      limit: parseInt(searchParams.get('limit') || '20'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Build base query
    let query = supabase
      .from('exchange_posts')
      .select(`
        id,
        user_id,
        title,
        description,
        download_count,
        test_count,
        chatbot_file,
        canvas_file,
        thread_file,
        created_at,
        is_published
      `)
      .eq('is_published', true);

    // Apply filters
    if (filter.user_id) {
      query = query.eq('user_id', filter.user_id);
    }

    if (filter.search) {
      query = query.or(`title.ilike.%${filter.search}%,description.ilike.%${filter.search}%`);
    }

    // Apply sorting
    query = query.order(filter.sort_by || 'created_at', {
      ascending: filter.sort_order === 'asc',
    });

    // Apply pagination
    query = query.range(
      filter.offset || 0,
      (filter.offset || 0) + (filter.limit || 20) - 1
    );

    const { data: posts, error: postsError } = await query;

    if (postsError) {
      console.error('[GET /api/exchange/posts] Database error:', postsError);
      return NextResponse.json(
        { error: 'Failed to fetch posts' },
        { status: 500 }
      );
    }

    if (!posts || posts.length === 0) {
      return NextResponse.json({ posts: [], total: 0 });
    }

    // Get post IDs for fetching related data
    const postIds = posts.map((p) => p.id);

    // Fetch categories for posts
    const { data: postCategories } = await supabase
      .from('exchange_post_categories')
      .select(`
        post_id,
        exchange_categories (name)
      `)
      .in('post_id', postIds);

    // Fetch tags for posts
    const { data: postTags } = await supabase
      .from('exchange_post_tags')
      .select(`
        post_id,
        exchange_tags (name)
      `)
      .in('post_id', postIds);

    // Filter by categories if specified
    let filteredPostIds = postIds;
    if (filter.category_ids && filter.category_ids.length > 0) {
      const { data: categoryPostIds } = await supabase
        .from('exchange_post_categories')
        .select('post_id')
        .in('category_id', filter.category_ids);

      if (categoryPostIds) {
        const matchingIds = new Set(categoryPostIds.map((c) => c.post_id));
        filteredPostIds = filteredPostIds.filter((id) => matchingIds.has(id));
      }
    }

    // Filter by tags if specified
    if (filter.tag_names && filter.tag_names.length > 0) {
      // First get tag IDs
      const { data: tagIds } = await supabase
        .from('exchange_tags')
        .select('id')
        .in('name', filter.tag_names);

      if (tagIds && tagIds.length > 0) {
        const { data: tagPostIds } = await supabase
          .from('exchange_post_tags')
          .select('post_id')
          .in('tag_id', tagIds.map((t) => t.id));

        if (tagPostIds) {
          const matchingIds = new Set(tagPostIds.map((t) => t.post_id));
          filteredPostIds = filteredPostIds.filter((id) => matchingIds.has(id));
        }
      }
    }

    // Build category and tag maps
    const categoryMap = new Map<string, string[]>();
    const tagMap = new Map<string, string[]>();

    postCategories?.forEach((pc: any) => {
      const cats = categoryMap.get(pc.post_id) || [];
      if (pc.exchange_categories?.name) {
        cats.push(pc.exchange_categories.name);
      }
      categoryMap.set(pc.post_id, cats);
    });

    postTags?.forEach((pt: any) => {
      const tags = tagMap.get(pt.post_id) || [];
      if (pt.exchange_tags?.name) {
        tags.push(pt.exchange_tags.name);
      }
      tagMap.set(pt.post_id, tags);
    });

    // Transform to preview format
    const previews: ExchangePostPreview[] = posts
      .filter((p) => filteredPostIds.includes(p.id))
      .map((post) => ({
        id: post.id,
        user_id: post.user_id,
        title: post.title,
        description: post.description,
        download_count: post.download_count,
        test_count: post.test_count,
        has_chatbot: !!post.chatbot_file,
        has_canvas: !!post.canvas_file,
        has_thread: !!post.thread_file,
        categories: categoryMap.get(post.id) || [],
        tags: tagMap.get(post.id) || [],
        created_at: post.created_at,
      }));

    // Get total count for pagination
    const { count } = await supabase
      .from('exchange_posts')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true);

    return NextResponse.json({
      posts: previews,
      total: count || 0,
    });
  } catch (error: any) {
    console.error('[GET /api/exchange/posts] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new post
 */
export async function POST(req: NextRequest) {
  try {
    const body: CreateExchangePostRequest = await req.json();
    const { title, description, chatbot_file, canvas_file, thread_file, category_ids, tag_names } = body;

    // Validate required fields
    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // At least one file is required
    if (!chatbot_file && !canvas_file && !thread_file) {
      return NextResponse.json(
        { error: 'At least one file (.chatbot, .canvas, or .thread) is required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get authenticated user from header (passed by middleware)
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Verify user exists and has valid tier
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
        { error: 'Active subscription required to post to Exchange' },
        { status: 403 }
      );
    }

    // Create the post
    const { data: post, error: postError } = await supabase
      .from('exchange_posts')
      .insert({
        user_id: userId,
        title,
        description,
        chatbot_file,
        canvas_file,
        thread_file,
        is_published: true,
      })
      .select()
      .single();

    if (postError) {
      console.error('[POST /api/exchange/posts] Insert error:', postError);
      return NextResponse.json(
        { error: 'Failed to create post' },
        { status: 500 }
      );
    }

    // Add categories
    if (category_ids && category_ids.length > 0) {
      const categoryInserts = category_ids.map((category_id) => ({
        post_id: post.id,
        category_id,
      }));

      const { error: catError } = await supabase
        .from('exchange_post_categories')
        .insert(categoryInserts);

      if (catError) {
        console.error('[POST /api/exchange/posts] Category insert error:', catError);
        // Non-fatal, continue
      }
    }

    // Add tags (create if they don't exist)
    if (tag_names && tag_names.length > 0) {
      for (const tagName of tag_names) {
        // Normalize tag name (lowercase, trim)
        const normalizedName = tagName.toLowerCase().trim();
        if (!normalizedName) continue;

        // Try to get existing tag
        let { data: existingTag } = await supabase
          .from('exchange_tags')
          .select('id')
          .eq('name', normalizedName)
          .single();

        let tagId: string;

        if (!existingTag) {
          // Create new tag
          const { data: newTag, error: tagError } = await supabase
            .from('exchange_tags')
            .insert({ name: normalizedName })
            .select('id')
            .single();

          if (tagError) {
            console.error('[POST /api/exchange/posts] Tag create error:', tagError);
            continue;
          }
          tagId = newTag.id;
        } else {
          tagId = existingTag.id;
        }

        // Link tag to post
        await supabase
          .from('exchange_post_tags')
          .insert({ post_id: post.id, tag_id: tagId });
      }
    }

    console.log(`[POST /api/exchange/posts] Created post ${post.id} by user ${userId}`);

    return NextResponse.json({
      success: true,
      post: {
        id: post.id,
        title: post.title,
        created_at: post.created_at,
      },
    });
  } catch (error: any) {
    console.error('[POST /api/exchange/posts] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
