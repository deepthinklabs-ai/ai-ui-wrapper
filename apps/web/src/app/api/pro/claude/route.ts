/**
 * @security-audit-requested
 * AUDIT FOCUS: Claude API proxy security
 * - Is userId properly authenticated (not just passed in body)?
 * - Can an attacker use another user's API key?
 * - Is the API key cleared from memory after use?
 * - Are there injection attacks possible via messages/tools?
 * - Can rate limiting be bypassed?
 */

/**
 * Claude (Anthropic) API Proxy (BYOK)
 *
 * This route allows authenticated users to use Claude models
 * using their own API keys stored in Google Secret Manager.
 * Includes rate limiting and usage tracking.
 *
 * BYOK: Users must configure their Claude API key in Settings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  checkRateLimit,
  recordUsage,
  recordRequestTimestamp,
  getRateLimitErrorMessage,
  getRateLimitHeaders,
} from '@/lib/rateLimiting';
import { getProviderKey } from '@/lib/secretManager/getKey';

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
    // Temporarily disable web search by default until we debug the refusal issue
    const { userId, messages, model = 'claude-sonnet-4-5', systemPrompt, tools, enableWebSearch = false } = body;

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

    // Initialize Supabase client (server-side with service role key)
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

    const userTier = profile.tier as 'trial' | 'pro' | 'expired' | 'pending';

    // Block expired and pending users
    if (userTier === 'expired') {
      return NextResponse.json(
        { error: 'Your trial has expired. Please subscribe to continue using the service.' },
        { status: 403 }
      );
    }

    if (userTier === 'pending') {
      return NextResponse.json(
        { error: 'Please complete your subscription setup to use the service.' },
        { status: 403 }
      );
    }

    // Only allow trial and pro users
    if (userTier !== 'trial' && userTier !== 'pro') {
      return NextResponse.json(
        { error: 'Invalid user tier. Please contact support.' },
        { status: 403 }
      );
    }

    // BYOK: Get user's Claude API key from Secret Manager
    let userApiKey = await getProviderKey(userId, 'claude');
    if (!userApiKey) {
      return NextResponse.json(
        {
          error: 'API key required',
          message: 'Please configure your Claude API key in Settings to use this model.',
          code: 'BYOK_KEY_MISSING',
        },
        { status: 403 }
      );
    }

    // Rate limiting check (uses tier-specific limits)
    console.log(`[API Claude] Checking rate limit for user=${userId}, tier=${userTier}, model=${model}`);
    const rateLimitResult = await checkRateLimit(supabase, userId, userTier, model);

    if (!rateLimitResult.allowed) {
      const errorMessage = getRateLimitErrorMessage(rateLimitResult.status);
      const headers = getRateLimitHeaders(rateLimitResult.status);

      console.log(`[PRO API Claude] Rate limited: user=${userId}, model=${model}, reason=${rateLimitResult.status.block_reason}`);

      // Security: Clear API key from memory
      userApiKey = null;

      return NextResponse.json(
        {
          error: errorMessage,
          rateLimited: true,
          resetTime: rateLimitResult.status.reset_time,
        },
        {
          status: 429,
          headers,
        }
      );
    }

    // Immediately record request timestamp for burst protection
    // This prevents race conditions with parallel requests
    await recordRequestTimestamp(supabase, userId, model);

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

    // Add web search tool if enabled
    if (enableWebSearch) {
      requestBody.tools = [
        {
          type: "web_search_20250305",
          name: "web_search",
        },
        ...(requestBody.tools || [])
      ];

      // Add instruction to include sources when using web search
      const webSearchInstruction = `\n\nIMPORTANT: When you use web search to find information, you MUST include the sources at the end of your response. Format sources as a "Sources:" section with the website names and URLs as markdown links.`;
      finalSystemPrompt = finalSystemPrompt
        ? finalSystemPrompt + webSearchInstruction
        : webSearchInstruction.trim();
    }

    // Add system prompt if we have one
    if (finalSystemPrompt) {
      requestBody.system = finalSystemPrompt;
    }

    // Add tools if provided (for MCP tool calling)
    if (tools && Array.isArray(tools) && tools.length > 0) {
      requestBody.tools = [...(requestBody.tools || []), ...tools];
    }

    // Make request to Claude API
    const startTime = Date.now();

    // Build headers - add beta header if web search is enabled
    // BYOK: Use user's API key
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': userApiKey,
      'anthropic-version': '2023-06-01',
    };

    // Web search requires the beta header to work properly
    // Without this, Claude sees the tool but doesn't execute server-side search
    if (enableWebSearch) {
      headers['anthropic-beta'] = 'web-search-2025-03-05';
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    // Security: Clear API key from memory after use
    userApiKey = null;

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

    // Log metadata only (not content for privacy)
    console.log('[Claude API] Response stop_reason:', data.stop_reason);
    console.log('[Claude API] Content blocks:', data.content?.length || 0, 'blocks');

    // If stop_reason indicates truncation, log warning
    if (data.stop_reason === 'max_tokens') {
      console.warn('[Claude API] Response was truncated due to max_tokens limit');
    }

    // Check if response contains tool use blocks that need client-side handling
    // Note: web_search_20250305 is a server-side tool - Anthropic handles it automatically
    // and returns the final text response in the same API call
    const hasClientToolUse = data.content?.some(
      (block: any) => block.type === 'tool_use' && !block.name?.startsWith('web_search')
    );

    // Extract ALL text content from Claude's response
    // For web search, the response may contain MULTIPLE text blocks:
    // - One before the search (e.g., "I'll check the weather...")
    // - One after the search (with actual results)
    // We need to combine all text blocks to get the complete response
    const textBlocks = data.content?.filter((block: any) => block.type === 'text') || [];
    let content = textBlocks.map((block: any) => block.text).join('\n\n');

    console.log('[Claude API] Found', textBlocks.length, 'text blocks');

    if (!content && !hasClientToolUse) {
      // No text and no client-side tool use means something went wrong
      console.error('[Claude API] No text content in response (block types:', data.content?.map((b: any) => b.type).join(', ') + ')');
      return NextResponse.json(
        { error: 'No response from Claude' },
        { status: 500 }
      );
    }

    // Extract token usage
    const usage = data.usage || {
      input_tokens: 0,
      output_tokens: 0,
    };

    const latency = Date.now() - startTime;
    const totalTokens = usage.input_tokens + usage.output_tokens;

    // Log usage for cost tracking
    console.log(`[PRO API Claude] User ${userId} | Model: ${model} | Tokens: ${totalTokens} | Latency: ${latency}ms`);

    // Record usage for rate limiting
    await recordUsage(supabase, userId, model, totalTokens);

    // Get updated rate limit status for headers
    const updatedRateLimitResult = await checkRateLimit(supabase, userId, userTier, model);
    const rateLimitHeaders = getRateLimitHeaders(updatedRateLimitResult.status);

    // Check if web search was used in this response
    const usedWebSearch = data.content?.some(
      (block: any) => block.type === 'web_search_tool_result' || block.name === 'web_search'
    );

    return NextResponse.json(
      {
        content: content,
        contentBlocks: data.content, // Include full content blocks for tool use
        usage: {
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          total_tokens: totalTokens,
        },
        stop_reason: data.stop_reason, // Include stop reason (can be 'tool_use')
        usedWebSearch, // Indicate if web search was used
        // Include warning if approaching limit
        rateLimitWarning: updatedRateLimitResult.status.warning_message,
      },
      { headers: rateLimitHeaders }
    );
  } catch (error: any) {
    console.error('Error in /api/pro/claude:', error);

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
// force recompile
