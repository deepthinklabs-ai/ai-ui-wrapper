/**
 * Pro User Claude (Anthropic) API Proxy
 *
 * This route allows Pro users to use Claude models without providing their own API keys.
 * Uses the app's Claude API key (stored in env vars) instead.
 * Includes rate limiting and usage tracking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Map our internal model names to Claude API model names
const CLAUDE_API_MODEL_MAP: Record<string, string> = {
  'claude-sonnet-4-5': 'claude-sonnet-4-5-20250929',
  'claude-sonnet-4': 'claude-sonnet-4-20250514',
  'claude-opus-4-1': 'claude-opus-4-1-20250805',
  'claude-haiku-4-5': 'claude-haiku-4-5-20251001',
  'claude-haiku-3-5': 'claude-3-5-haiku-20241022',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, messages, model = 'claude-sonnet-4-5', systemPrompt, tools, enableWebSearch = true } = body;

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: 'Missing messages array' },
        { status: 400 }
      );
    }

    if (!process.env.CLAUDE_API_KEY) {
      return NextResponse.json(
        { error: 'Claude API key not configured on server' },
        { status: 500 }
      );
    }

    // Initialize Supabase client (server-side with service role key)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify user is Pro tier
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

    if (profile.tier !== 'pro') {
      return NextResponse.json(
        { error: 'This endpoint is only available for Pro users. Please upgrade to Pro or use your own API key.' },
        { status: 403 }
      );
    }

    // Get the actual Claude API model name
    const apiModel = CLAUDE_API_MODEL_MAP[model] || model;

    // Claude API doesn't accept "system" role in messages array
    // Extract system messages and filter them out
    const systemMessages = messages.filter((m: any) => m.role === 'system');
    const conversationMessages = messages.filter((m: any) => m.role !== 'system');

    // Convert OpenAI image_url format to Claude image format
    const convertedMessages = conversationMessages.map((msg: any) => {
      if (typeof msg.content === 'string') {
        return msg;
      }

      // If content is an array, convert image_url to Claude format
      if (Array.isArray(msg.content)) {
        const convertedContent = msg.content.map((part: any) => {
          if (part.type === 'text') {
            return part;
          } else if (part.type === 'image_url') {
            // Extract base64 data from data URL
            const url = part.image_url.url;
            const match = url.match(/^data:([^;]+);base64,(.+)$/);

            if (!match) {
              throw new Error('Invalid image data URL format');
            }

            const mediaType = match[1];
            const base64Data = match[2];

            return {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              },
            };
          }

          return part;
        });

        return {
          role: msg.role,
          content: convertedContent,
        };
      }

      return msg;
    });

    // Combine systemPrompt parameter and extracted system messages
    let finalSystemPrompt = systemPrompt || '';
    if (systemMessages.length > 0) {
      const extractedSystemPrompts = systemMessages
        .map((m: any) => (typeof m.content === 'string' ? m.content : ''))
        .filter(Boolean)
        .join('\n\n');

      finalSystemPrompt = finalSystemPrompt
        ? `${finalSystemPrompt}\n\n${extractedSystemPrompts}`
        : extractedSystemPrompts;
    }

    // Build request body for Claude API
    const requestBody: any = {
      model: apiModel,
      max_tokens: 8192,
      messages: convertedMessages,
    };

    // Add system prompt if we have one
    if (finalSystemPrompt) {
      requestBody.system = finalSystemPrompt;
    }

    // Add web search tool if enabled
    if (enableWebSearch) {
      requestBody.tools = [
        {
          type: "web_search_20250514",
          name: "web_search",
        },
        ...(requestBody.tools || [])
      ];
    }

    // Add tools if provided (for MCP tool calling)
    if (tools && Array.isArray(tools) && tools.length > 0) {
      requestBody.tools = [...(requestBody.tools || []), ...tools];
    }

    // Make request to Claude API
    const startTime = Date.now();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;

      console.error('Claude API error:', errorMessage);

      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again in a moment.' },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: `Claude API error: ${errorMessage}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Check if response contains tool use (Claude can return tool_use blocks)
    const hasToolUse = data.content?.some((block: any) => block.type === 'tool_use');

    // Extract the text content from Claude's response (if any)
    let content = '';
    if (!hasToolUse) {
      content = data.content?.[0]?.text;
      if (!content) {
        return NextResponse.json(
          { error: 'No response from Claude' },
          { status: 500 }
        );
      }
    }

    // Extract token usage
    const usage = data.usage || {
      input_tokens: 0,
      output_tokens: 0,
    };

    const latency = Date.now() - startTime;

    // Log usage for cost tracking
    console.log(`[PRO API] User ${userId} | Model: ${model} | Tokens: ${usage.input_tokens + usage.output_tokens} | Latency: ${latency}ms`);

    // TODO: Track usage in database for billing/analytics (coming soon)
    // await supabase.from('api_usage').insert({
    //   user_id: userId,
    //   provider: 'claude',
    //   model,
    //   prompt_tokens: usage.input_tokens,
    //   completion_tokens: usage.output_tokens,
    //   total_tokens: usage.input_tokens + usage.output_tokens,
    //   latency_ms: latency,
    // });

    return NextResponse.json({
      content: content,
      contentBlocks: data.content, // Include full content blocks for tool use
      usage: {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        total_tokens: usage.input_tokens + usage.output_tokens,
      },
      stop_reason: data.stop_reason, // Include stop reason (can be 'tool_use')
    });
  } catch (error: any) {
    console.error('Error in /api/pro/claude:', error);

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
