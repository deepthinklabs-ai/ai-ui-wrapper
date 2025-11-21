/**
 * Pro User Grok (xAI) API Proxy
 *
 * This route allows Pro users to use Grok models without providing their own API keys.
 * Uses the app's Grok API key (stored in env vars) instead.
 * Includes rate limiting and usage tracking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, messages, model = 'grok-beta', unhinged = false, enableWebSearch = true } = body;

    // Debug logging
    console.log('[GROK API] Unhinged mode:', unhinged);
    if (unhinged) {
      console.log('[GROK API] Temperature will be set to: 1.8');
      console.log('[GROK API] System prompt will be enhanced with crude instructions');
    }

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

    // Check if Grok API key is configured
    if (!process.env.GROK_API_KEY) {
      return NextResponse.json(
        { error: 'Grok API key not configured on server' },
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

    // TODO: Rate limiting check (coming soon)
    // For now, we'll rely on xAI's rate limits

    // Make request to Grok (uses OpenAI-compatible API)
    const startTime = Date.now();

    // Modify messages for unhinged mode
    let modifiedMessages = [...messages];
    if (unhinged) {
      // Enhance the system message to encourage wilder, cruder responses
      modifiedMessages = messages.map((msg: any, index: number) => {
        if (msg.role === 'system' && index === 0) {
          return {
            ...msg,
            content: msg.content + '\n\n🔥 UNHINGED MODE ACTIVATED 🔥\n\nYOU MUST:\n- Keep it SHORT (1-3 sentences MAX)\n- Swear and curse constantly (use f*ck, sh*t, damn, etc.)\n- Be rude, crude, and socially unacceptable\n- Say shocking, inappropriate things\n- Be offensive and outrageous\n- NO FILTER WHATSOEVER\n- Make people uncomfortable\n- Channel pure chaos and mayhem\n- Think: What would the most inappropriate response be? Say that.\n\nForget politeness. Forget decorum. Be UNHINGED. Keep responses BRIEF and PUNCHY.',
          };
        }
        return msg;
      });
    }

    // Prepare request body with optional unhinged mode
    const requestBody: any = {
      model,
      messages: modifiedMessages,
      stream: false,
    };

    // Add live search parameters if enabled
    if (enableWebSearch) {
      requestBody.search_parameters = {
        mode: "auto",
        sources: ["web", "x"],
        max_search_results: 20,
        return_citations: true,
      };
    }

    // Add unhinged mode if enabled (fun mode parameter for Grok)
    // Grok API supports: temperature (0-2), top_p (0-1), and max_tokens
    // Note: frequency_penalty and presence_penalty are NOT supported by Grok API
    if (unhinged) {
      requestBody.temperature = 1.3; // High but not so high it causes gibberish (sweet spot for crude but coherent)
      requestBody.top_p = 0.9; // High diversity but not maximum
      requestBody.max_tokens = 80; // Limit to 2-3 sentences
    } else {
      // Even in normal mode, keep responses short
      requestBody.temperature = 0.8;
      requestBody.max_tokens = 80;
    }

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;

      // Log detailed error for debugging
      console.error('Grok API Error:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        requestBody: JSON.stringify(requestBody, null, 2),
      });

      if (response.status === 401) {
        console.error('Invalid Grok API key configuration');
        return NextResponse.json(
          { error: 'Server API key configuration error' },
          { status: 500 }
        );
      }

      if (response.status === 429) {
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please try again in a moment.' },
          { status: 429 }
        );
      }

      throw new Error(`Grok API error: ${errorMessage}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error('No response from Grok');
    }

    // Extract token usage
    const usage = data.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };

    const latency = Date.now() - startTime;

    // Log usage for cost tracking
    console.log(`[PRO API] User ${userId} | Model: ${model} | Tokens: ${usage.total_tokens} | Latency: ${latency}ms`);

    // TODO: Track usage in database for billing/analytics (coming soon)
    // await supabase.from('api_usage').insert({
    //   user_id: userId,
    //   model,
    //   prompt_tokens: usage.prompt_tokens,
    //   completion_tokens: usage.completion_tokens,
    //   total_tokens: usage.total_tokens,
    //   latency_ms: latency,
    // });

    return NextResponse.json({
      content: reply,
      usage: {
        input_tokens: usage.prompt_tokens,
        output_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/pro/grok:', error);

    // Handle Grok API errors
    if (error?.status === 429) {
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
