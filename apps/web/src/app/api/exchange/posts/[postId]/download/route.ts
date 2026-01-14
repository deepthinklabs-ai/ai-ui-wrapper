/**
 * Exchange Post Download API
 *
 * GET /api/exchange/posts/[postId]/download - Download files from a post
 * Query params:
 *   - type: 'chatbot' | 'canvas' | 'thread' | 'bundle'
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { ExchangeBundle, DownloadFileType } from '@/app/exchange/types';
import { CHATBOT_FILE_EXTENSION } from '@/types/chatbotFile';
import { CANVAS_FILE_EXTENSION } from '@/types/canvasFile';
import { THREAD_FILE_EXTENSION } from '@/types/threadFile';
import { BUNDLE_FILE_EXTENSION, BUNDLE_FILE_VERSION } from '@/app/exchange/types';
import { withDebug } from '@/lib/debug';

type RouteParams = { params: Promise<{ postId: string }> };

/**
 * GET - Download files from a post
 */
export const GET = withDebug(async (req, sessionId, { params }: RouteParams) => {
  try {
    const { postId } = await params;
    const { searchParams } = new URL(req.url);
    const fileType = searchParams.get('type') as DownloadFileType;

    // Validate file type
    if (!fileType || !['chatbot', 'canvas', 'thread', 'bundle'].includes(fileType)) {
      return NextResponse.json(
        { error: 'Invalid file type. Must be one of: chatbot, canvas, thread, bundle' },
        { status: 400 }
      );
    }

    // Get authenticated user (optional for downloads, but needed for tracking)
    const userId = req.headers.get('x-user-id');

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
      .eq('is_published', true)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Determine what to return based on file type
    let content: string;
    let filename: string;
    let mimeType = 'application/json';

    // Sanitize title for filename
    const sanitizedTitle = (post.title || 'export')
      .replace(/[<>:"/\\|?*]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 50);

    const timestamp = new Date().toISOString().split('T')[0];

    switch (fileType) {
      case 'chatbot':
        if (!post.chatbot_file) {
          return NextResponse.json(
            { error: 'This post does not contain a chatbot file' },
            { status: 404 }
          );
        }
        content = JSON.stringify(post.chatbot_file, null, 2);
        filename = `${sanitizedTitle}_${timestamp}${CHATBOT_FILE_EXTENSION}`;
        break;

      case 'canvas':
        if (!post.canvas_file) {
          return NextResponse.json(
            { error: 'This post does not contain a canvas file' },
            { status: 404 }
          );
        }
        content = JSON.stringify(post.canvas_file, null, 2);
        filename = `${sanitizedTitle}_${timestamp}${CANVAS_FILE_EXTENSION}`;
        break;

      case 'thread':
        if (!post.thread_file) {
          return NextResponse.json(
            { error: 'This post does not contain a thread file' },
            { status: 404 }
          );
        }
        content = JSON.stringify(post.thread_file, null, 2);
        filename = `${sanitizedTitle}_${timestamp}${THREAD_FILE_EXTENSION}`;
        break;

      case 'bundle':
        // Create bundle with all available files
        const bundle: ExchangeBundle = {
          version: BUNDLE_FILE_VERSION,
          type: 'bundle',
          post_id: post.id,
          title: post.title,
          description: post.description,
          exported_at: new Date().toISOString(),
          files: {},
        };

        if (post.chatbot_file) {
          bundle.files.chatbot = post.chatbot_file;
        }
        if (post.canvas_file) {
          bundle.files.canvas = post.canvas_file;
        }
        if (post.thread_file) {
          bundle.files.thread = post.thread_file;
        }

        if (Object.keys(bundle.files).length === 0) {
          return NextResponse.json(
            { error: 'This post does not contain any downloadable files' },
            { status: 404 }
          );
        }

        content = JSON.stringify(bundle, null, 2);
        filename = `${sanitizedTitle}_${timestamp}${BUNDLE_FILE_EXTENSION}`;
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid file type' },
          { status: 400 }
        );
    }

    // Record download if user is authenticated
    if (userId) {
      await supabase
        .from('exchange_downloads')
        .insert({
          post_id: postId,
          user_id: userId,
          file_type: fileType,
        });
    }

    console.log(`[GET /api/exchange/posts/[postId]/download] Downloaded ${fileType} from post ${postId}`);

    // Return file as download
    return new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('[GET /api/exchange/posts/[postId]/download] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
});
