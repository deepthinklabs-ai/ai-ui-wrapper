/**
 * Exchange Single Post API
 *
 * GET /api/exchange/posts/[postId] - Get single post with full details
 * PATCH /api/exchange/posts/[postId] - Update post (description and categories/tags only)
 * DELETE /api/exchange/posts/[postId] - Delete post
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { UpdateExchangePostRequest, ExchangePostDetail } from '@/app/exchange/types';

type RouteParams = { params: Promise<{ postId: string }> };

/**
 * GET - Get single post with full details
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { postId } = await params;

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch post
    const { data: post, error: postError } = await supabase
      .from('exchange_posts')
      .select('*')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Check visibility
    if (!post.is_published) {
      // Only owner can see unpublished posts
      const userId = req.headers.get('x-user-id');
      if (post.user_id !== userId) {
        return NextResponse.json(
          { error: 'Post not found' },
          { status: 404 }
        );
      }
    }

    // Fetch categories
    const { data: postCategories } = await supabase
      .from('exchange_post_categories')
      .select(`
        exchange_categories (*)
      `)
      .eq('post_id', postId);

    // Fetch tags
    const { data: postTags } = await supabase
      .from('exchange_post_tags')
      .select(`
        exchange_tags (*)
      `)
      .eq('post_id', postId);

    // Fetch author name
    const { data: authorProfile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', post.user_id)
      .single();

    // Get author email from auth.users (need to use auth admin)
    let authorName = 'Anonymous';
    const { data: { user: authorUser } } = await supabase.auth.admin.getUserById(post.user_id);
    if (authorUser?.email) {
      authorName = authorUser.email.split('@')[0]; // Use email prefix as name
    }

    // Extract derived fields from chatbot config
    const chatbotConfig = post.chatbot_file?.config;
    const provider = chatbotConfig?.model?.provider;
    const modelName = chatbotConfig?.model?.model_name;
    const oauthRequirements = chatbotConfig?.oauth_requirements || post.canvas_file?.oauth_requirements;
    const hasOAuthRequirements = oauthRequirements && Object.values(oauthRequirements).some(Boolean);

    // Build response
    const response: ExchangePostDetail = {
      ...post,
      categories: postCategories?.map((pc: any) => pc.exchange_categories).filter(Boolean) || [],
      tags: postTags?.map((pt: any) => pt.exchange_tags).filter(Boolean) || [],
      author: {
        name: authorName,
      },
      // Derived fields
      provider,
      model_name: modelName,
      has_oauth_requirements: hasOAuthRequirements,
      oauth_requirements: oauthRequirements,
    };

    return NextResponse.json({ post: response });
  } catch (error: any) {
    console.error('[GET /api/exchange/posts/[postId]] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH - Update post (only description and categories/tags - files are immutable)
 */
export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { postId } = await params;
    const body: UpdateExchangePostRequest = await req.json();
    const { description, category_ids, tag_names } = body;

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

    // Verify ownership
    const { data: post, error: postError } = await supabase
      .from('exchange_posts')
      .select('user_id')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    if (post.user_id !== userId) {
      return NextResponse.json(
        { error: 'Not authorized to update this post' },
        { status: 403 }
      );
    }

    // Update description if provided
    if (description !== undefined) {
      const { error: updateError } = await supabase
        .from('exchange_posts')
        .update({ description })
        .eq('id', postId);

      if (updateError) {
        console.error('[PATCH /api/exchange/posts/[postId]] Update error:', updateError);
        return NextResponse.json(
          { error: 'Failed to update post' },
          { status: 500 }
        );
      }
    }

    // Update categories if provided
    if (category_ids !== undefined) {
      // Delete existing categories
      await supabase
        .from('exchange_post_categories')
        .delete()
        .eq('post_id', postId);

      // Insert new categories
      if (category_ids.length > 0) {
        const categoryInserts = category_ids.map((category_id) => ({
          post_id: postId,
          category_id,
        }));

        await supabase
          .from('exchange_post_categories')
          .insert(categoryInserts);
      }
    }

    // Update tags if provided
    if (tag_names !== undefined) {
      // Delete existing tags
      await supabase
        .from('exchange_post_tags')
        .delete()
        .eq('post_id', postId);

      // Insert new tags
      for (const tagName of tag_names) {
        const normalizedName = tagName.toLowerCase().trim();
        if (!normalizedName) continue;

        // Get or create tag
        let { data: existingTag } = await supabase
          .from('exchange_tags')
          .select('id')
          .eq('name', normalizedName)
          .single();

        let tagId: string;

        if (!existingTag) {
          const { data: newTag } = await supabase
            .from('exchange_tags')
            .insert({ name: normalizedName })
            .select('id')
            .single();

          if (!newTag) continue;
          tagId = newTag.id;
        } else {
          tagId = existingTag.id;
        }

        await supabase
          .from('exchange_post_tags')
          .insert({ post_id: postId, tag_id: tagId });
      }
    }

    console.log(`[PATCH /api/exchange/posts/[postId]] Updated post ${postId} by user ${userId}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[PATCH /api/exchange/posts/[postId]] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete post (owner only)
 */
export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { postId } = await params;

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

    // Verify ownership
    const { data: post, error: postError } = await supabase
      .from('exchange_posts')
      .select('user_id')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    if (post.user_id !== userId) {
      return NextResponse.json(
        { error: 'Not authorized to delete this post' },
        { status: 403 }
      );
    }

    // Delete post (cascade will handle related records)
    const { error: deleteError } = await supabase
      .from('exchange_posts')
      .delete()
      .eq('id', postId);

    if (deleteError) {
      console.error('[DELETE /api/exchange/posts/[postId]] Delete error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete post' },
        { status: 500 }
      );
    }

    console.log(`[DELETE /api/exchange/posts/[postId]] Deleted post ${postId} by user ${userId}`);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[DELETE /api/exchange/posts/[postId]] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
