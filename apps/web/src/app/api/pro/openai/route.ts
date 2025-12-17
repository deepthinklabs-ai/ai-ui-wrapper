/**
 * @security-audit-requested
 * AUDIT FOCUS: OpenAI API proxy security
 * - Is userId properly authenticated (not just passed in body)?
 * - Can an attacker use another user's API key?
 * - Is the API key cleared from memory after use?
 * - Are there injection attacks possible via messages/tools?
 * - Can rate limiting be bypassed?
 */

/**
 * OpenAI API Proxy (BYOK)
 *
 * This route allows authenticated users to use OpenAI models
 * using their own API keys stored in Google Secret Manager.
 * Includes rate limiting and usage tracking.
 *
 * BYOK: Users must configure their OpenAI API key in Settings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import {
  checkRateLimit,
  recordUsage,
  recordRequestTimestamp,
  getRateLimitErrorMessage,
  getRateLimitHeaders,
} from '@/lib/rateLimiting';
import { getProviderKey } from '@/lib/secretManager/getKey';

// Map models to their search-enabled variants
const SEARCH_ENABLED_MODELS: Record<string, string> = {
  'gpt-5.1': 'gpt-5.1',
  'gpt-5-mini': 'gpt-5-mini',
  'gpt-5-nano': 'gpt-5-nano',
  'gpt-4o': 'gpt-4o-search-preview',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, messages, model = 'gpt-4o', enableWebSearch = true, tools, systemPrompt } = body;

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

    // BYOK: Get user's OpenAI API key from Secret Manager
    let userApiKey = await getProviderKey(userId, 'openai');
    if (!userApiKey) {
      return NextResponse.json(
        {
          error: 'API key required',
          message: 'Please configure your OpenAI API key in Settings to use this model.',
          code: 'BYOK_KEY_MISSING',
        },
        { status: 403 }
      );
    }

    // Rate limiting check (uses tier-specific limits)
    console.log(`[API] Checking rate limit for user=${userId}, tier=${userTier}, model=${model}`);
    const rateLimitResult = await checkRateLimit(supabase, userId, userTier, model);
    console.log(`[PRO API] Rate limit result: allowed=${rateLimitResult.allowed}, reason=${rateLimitResult.status.block_reason || 'none'}, requests_used=${rateLimitResult.status.daily_requests_used}/${rateLimitResult.status.daily_requests_limit}`);

    if (!rateLimitResult.allowed) {
      const errorMessage = getRateLimitErrorMessage(rateLimitResult.status);
      const headers = getRateLimitHeaders(rateLimitResult.status);

      console.log(`[PRO API] Rate limited: user=${userId}, model=${model}, reason=${rateLimitResult.status.block_reason}`);

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

    // Use search-enabled model if available and requested
    const actualModel = enableWebSearch && SEARCH_ENABLED_MODELS[model]
      ? SEARCH_ENABLED_MODELS[model]
      : model;

    // Build messages with optional system prompt
    let finalMessages = messages;
    if (systemPrompt) {
      finalMessages = [{ role: 'system', content: systemPrompt }, ...messages];
    }

    const completionParams: any = {
      model: actualModel,
      messages: finalMessages,
    };

    // BYOK: Create OpenAI client with user's API key
    const openai = new OpenAI({
      apiKey: userApiKey,
    });

    // Add tools if provided (for Gmail, Sheets, etc.)
    if (tools && Array.isArray(tools) && tools.length > 0) {
      // Convert to OpenAI function format
      completionParams.tools = tools.map((tool: any) => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema || tool.parameters,
        },
      }));

      // Check if this looks like an email send request - force tool use
      const lastUserMessage = messages.filter((m: any) => m.role === 'user').pop();
      const messageText = typeof lastUserMessage?.content === 'string'
        ? lastUserMessage.content
        : JSON.stringify(lastUserMessage?.content || '');

      const isEmailRequest = /send.*email|email.*to|mail.*to/i.test(messageText);
      const hasGmailSend = tools.some((t: any) => t.name === 'gmail_send');

      if (isEmailRequest && hasGmailSend) {
        // Force the model to use the gmail_send tool
        completionParams.tool_choice = { type: 'function', function: { name: 'gmail_send' } };
        console.log('[PRO API] Forcing gmail_send tool for email request');
      }
    }

    // Make request to OpenAI
    const startTime = Date.now();
    const completion = await openai.chat.completions.create(completionParams);

    // Security: Clear API key from memory after use
    userApiKey = null;

    // Log metadata only (not content for privacy)

    const message = completion.choices?.[0]?.message;
    const reply = message?.content;
    const toolCalls = message?.tool_calls;

    // If the model made tool calls, return them for execution
    if (toolCalls && toolCalls.length > 0) {
      console.log(`[PRO API] Model made ${toolCalls.length} tool calls`);
      const latency = Date.now() - startTime;
      const tokensUsed = completion.usage?.total_tokens || 0;
      console.log(`[PRO API] User ${userId} | Model: ${model} | Tool calls: ${toolCalls.length} | Tokens: ${tokensUsed} | Latency: ${latency}ms`);

      // Record usage for rate limiting
      await recordUsage(supabase, userId, model, tokensUsed);

      // Get updated rate limit status for headers
      const updatedRateLimitResult = await checkRateLimit(supabase, userId, userTier, model);
      const rateLimitHeaders = getRateLimitHeaders(updatedRateLimitResult.status);

      return NextResponse.json(
        {
          content: reply || '',
          toolCalls: toolCalls.map((tc: any) => ({
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments || '{}'),
          })),
          usage: completion.usage ? {
            prompt_tokens: completion.usage.prompt_tokens,
            completion_tokens: completion.usage.completion_tokens,
            total_tokens: completion.usage.total_tokens,
          } : undefined,
          // Include warning if approaching limit
          rateLimitWarning: updatedRateLimitResult.status.warning_message,
        },
        { headers: rateLimitHeaders }
      );
    }

    if (!reply) {
      throw new Error('No response from OpenAI');
    }

    // Extract token usage
    const usage = completion.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };

    const latency = Date.now() - startTime;

    // Log usage for cost tracking
    console.log(`[PRO API] User ${userId} | Model: ${model} | Tokens: ${usage.total_tokens} | Latency: ${latency}ms`);

    // Record usage for rate limiting
    await recordUsage(supabase, userId, model, usage.total_tokens);

    // Get updated rate limit status for headers
    const updatedRateLimitResult = await checkRateLimit(supabase, userId, userTier, model);
    const rateLimitHeaders = getRateLimitHeaders(updatedRateLimitResult.status);

    // Extract citations from annotations (for search-enabled models)
    // Reuse `message` from line 125 instead of fetching again
    const annotations = (message as any)?.annotations || [];

    // Debug logging to see what we're getting
    if (annotations.length > 0) {
      console.log(`[PRO API] Found ${annotations.length} annotations:`, JSON.stringify(annotations, null, 2));
    }

    const annotationCitations: Array<{ url: string; title?: string; cited_text?: string }> = annotations
      .filter((ann: any) => ann.type === 'url_citation' && ann.url_citation?.url)
      .map((ann: any) => ({
        url: ann.url_citation.url,
        title: ann.url_citation.title || undefined,
        cited_text: ann.url_citation.text || undefined,
      }));

    // Also extract inline markdown links from the response text
    // This catches URLs the AI explicitly formatted in its response
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const inlineLinks: Array<{ url: string; title?: string }> = [];
    let match;

    while ((match = markdownLinkRegex.exec(reply)) !== null) {
      const [, title, url] = match;
      // Only include http/https URLs, skip relative links
      if (url.startsWith('http://') || url.startsWith('https://')) {
        inlineLinks.push({ url, title });
      }
    }

    console.log(`[PRO API] Found ${inlineLinks.length} inline markdown links in response`);

    // Combine both sources of citations, preferring inline links (more specific)
    // Use a Map to deduplicate by URL
    const citationMap = new Map<string, { url: string; title?: string; cited_text?: string }>();

    // Add inline links first (higher priority)
    inlineLinks.forEach(link => {
      citationMap.set(link.url, { url: link.url, title: link.title });
    });

    // Add annotation citations (only if URL not already present)
    annotationCitations.forEach(citation => {
      if (!citationMap.has(citation.url)) {
        citationMap.set(citation.url, citation);
      }
    });

    const citations = Array.from(citationMap.values());

    if (citations.length > 0) {
      console.log(`[PRO API] Final ${citations.length} citations (combined):`, JSON.stringify(citations, null, 2));
    }

    return NextResponse.json(
      {
        content: reply,
        usage: {
          prompt_tokens: usage.prompt_tokens,
          completion_tokens: usage.completion_tokens,
          total_tokens: usage.total_tokens,
        },
        citations: citations.length > 0 ? citations : undefined,
        // Include warning if approaching limit
        rateLimitWarning: updatedRateLimitResult.status.warning_message,
      },
      { headers: rateLimitHeaders }
    );
  } catch (error: any) {
    console.error('Error in /api/pro/openai:', error);

    // Handle OpenAI API errors
    if (error?.status === 429) {
      // Check if it's a token limit error vs rate limit
      const errorMessage = error?.message || '';
      const isTokenLimitError = errorMessage.includes('tokens per min') || errorMessage.includes('TPM');

      if (isTokenLimitError) {
        return NextResponse.json(
          {
            error: 'Request too large: The conversation history plus your message exceeds the OpenAI token limit. Try starting a new thread or using a shorter message.'
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again in a moment.' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
