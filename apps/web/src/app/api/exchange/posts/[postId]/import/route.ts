/**
 * Exchange Post Import API
 *
 * POST /api/exchange/posts/[postId]/import
 * Imports a thread file from an Exchange post directly into the user's account.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface ImportRequest {
  /** Optional folder ID to place the imported thread */
  folder_id?: string | null;
}

/**
 * POST - Import thread from Exchange post into user's account
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;

  console.log('[ImportThread] Starting import for post:', postId);

  try {
    // Get authenticated user from header
    const userId = req.headers.get('x-user-id');
    if (!userId) {
      console.log('[ImportThread] No user ID provided');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body (optional)
    let body: ImportRequest = {};
    try {
      body = await req.json();
    } catch {
      // Body is optional
    }

    // Initialize Supabase client with service role for cross-user access
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Fetch the Exchange post
    console.log('[ImportThread] Fetching post data...');
    const { data: post, error: postError } = await supabase
      .from('exchange_posts')
      .select('id, title, thread_file, is_published')
      .eq('id', postId)
      .single();

    if (postError || !post) {
      console.error('[ImportThread] Post not found:', postError);
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    if (!post.is_published) {
      console.log('[ImportThread] Post is not published');
      return NextResponse.json(
        { error: 'Post is not available' },
        { status: 403 }
      );
    }

    if (!post.thread_file) {
      console.log('[ImportThread] Post does not contain a thread file');
      return NextResponse.json(
        { error: 'This post does not contain a thread file' },
        { status: 400 }
      );
    }

    console.log('[ImportThread] Thread file found, parsing...');
    const threadFile = post.thread_file as any;

    // Validate thread file structure
    if (!threadFile.metadata) {
      console.error('[ImportThread] Invalid thread file structure - no metadata');
      return NextResponse.json(
        { error: 'Invalid thread file structure' },
        { status: 400 }
      );
    }

    // Get the target folder (use provided folder_id or user's default folder)
    let targetFolderId = body.folder_id;
    if (!targetFolderId) {
      console.log('[ImportThread] Finding default folder for user...');
      const { data: defaultFolder } = await supabase
        .from('folders')
        .select('id')
        .eq('user_id', userId)
        .eq('is_default', true)
        .single();

      targetFolderId = defaultFolder?.id || null;
      console.log('[ImportThread] Using folder:', targetFolderId || 'none');
    }

    // Create the thread with title from post or metadata
    const threadTitle = `${post.title || threadFile.metadata.name || 'Imported Thread'} (from Exchange)`;

    console.log('[ImportThread] Creating thread:', threadTitle);
    const { data: newThread, error: threadError } = await supabase
      .from('threads')
      .insert({
        user_id: userId,
        title: threadTitle,
        folder_id: targetFolderId,
        chatbot_id: threadFile.metadata.chatbot_id || null,
        position: 0,
      })
      .select()
      .single();

    if (threadError || !newThread) {
      console.error('[ImportThread] Failed to create thread:', threadError);
      return NextResponse.json(
        { error: 'Failed to create thread' },
        { status: 500 }
      );
    }

    console.log('[ImportThread] Thread created:', newThread.id);

    // Import messages if they exist in the thread file
    let messageCount = 0;
    if (threadFile.messages && Array.isArray(threadFile.messages) && threadFile.messages.length > 0) {
      console.log('[ImportThread] Importing', threadFile.messages.length, 'messages...');

      const messagesToInsert = threadFile.messages.map((msg: any) => {
        const messageData: Record<string, any> = {
          thread_id: newThread.id,
          role: msg.role || 'user',
          content: msg.content || '',
          model: msg.model || null,
        };

        // Only add optional fields if they have valid values
        if (msg.attachments && msg.attachments.length > 0) {
          messageData.attachments = msg.attachments;
        }
        if (msg.input_tokens != null) {
          messageData.input_tokens = msg.input_tokens;
        }
        if (msg.output_tokens != null) {
          messageData.output_tokens = msg.output_tokens;
        }
        if (msg.total_tokens != null) {
          messageData.total_tokens = msg.total_tokens;
        }
        if (msg.tool_calls && msg.tool_calls.length > 0) {
          messageData.tool_calls = msg.tool_calls;
        }
        if (msg.tool_results && msg.tool_results.length > 0) {
          messageData.tool_results = msg.tool_results;
        }
        if (msg.citations && msg.citations.length > 0) {
          messageData.citations = msg.citations;
        }

        return messageData;
      });

      const { error: messagesError } = await supabase
        .from('messages')
        .insert(messagesToInsert);

      if (messagesError) {
        console.error('[ImportThread] Failed to import messages:', messagesError);
        // Clean up the thread if messages failed
        await supabase.from('threads').delete().eq('id', newThread.id);
        return NextResponse.json(
          { error: 'Failed to import messages' },
          { status: 500 }
        );
      }

      messageCount = messagesToInsert.length;
      console.log('[ImportThread] Messages imported:', messageCount);
    }

    // Increment download count for the post
    console.log('[ImportThread] Incrementing download count...');
    await supabase
      .from('exchange_posts')
      .update({ download_count: (post as any).download_count + 1 || 1 })
      .eq('id', postId);

    console.log('[ImportThread] Import complete!');
    return NextResponse.json({
      success: true,
      thread_id: newThread.id,
      title: threadTitle,
      message_count: messageCount,
    });
  } catch (error: any) {
    console.error('[ImportThread] Unexpected error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
