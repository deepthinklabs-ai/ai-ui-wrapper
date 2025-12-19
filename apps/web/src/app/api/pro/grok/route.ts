/**
 * @security-audit-requested
 * AUDIT FOCUS: Grok API proxy security
 * - Is userId properly authenticated (not just passed in body)? ✅ FIXED
 * - Can an attacker use another user's API key? ✅ FIXED - uses authenticated userId
 * - Is the API key cleared from memory after use?
 * - Are there injection attacks possible via messages/tools?
 * - Can rate limiting be bypassed?
 */

/**
 * Grok (xAI) API Proxy (BYOK)
 *
 * This route allows authenticated users to use Grok models
 * using their own API keys stored in Google Secret Manager.
 * Includes rate limiting and usage tracking.
 *
 * BYOK: Users must configure their Grok API key in Settings.
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
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { checkAIEnabled } from '@/lib/killSwitches';

export async function POST(req: NextRequest) {
  // Declare outside try so it can be cleared in catch/finally
  let userApiKey: string | null = null;

  try {
    // SECURITY: Authenticate user from session token, not from request body
    const { user, error: authError } = await getAuthenticatedUser(req);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authError || 'Authentication required' },
        { status: 401 }
      );
    }
    const userId = user.id; // Use authenticated user ID, never trust client

    // KILL SWITCH: Check if AI features are enabled
    const aiCheck = await checkAIEnabled();
    if (!aiCheck.enabled) {
      return NextResponse.json(
        { error: aiCheck.error!.message },
        { status: aiCheck.error!.status }
      );
    }

    const body = await req.json();
    const { messages, model = 'grok-beta', unhinged = false, enableWebSearch = true } = body;

    // Debug logging
    console.log('[GROK API] Unhinged mode:', unhinged);
    if (unhinged) {
      console.log('[GROK API] Temperature will be set to: 1.8');
      console.log('[GROK API] System prompt will be enhanced with crude instructions');
    }

    // Validate required fields
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

    // BYOK: Get user's Grok API key from Secret Manager
    userApiKey = await getProviderKey(userId, 'grok');
    if (!userApiKey) {
      return NextResponse.json(
        {
          error: 'API key required',
          message: 'Please configure your Grok API key in Settings to use this model.',
          code: 'BYOK_KEY_MISSING',
        },
        { status: 403 }
      );
    }

    // Rate limiting check (uses tier-specific limits)
    console.log(`[API Grok] Checking rate limit for user=${userId}, tier=${userTier}, model=${model}`);
    const rateLimitResult = await checkRateLimit(supabase, userId, userTier, model);

    if (!rateLimitResult.allowed) {
      const errorMessage = getRateLimitErrorMessage(rateLimitResult.status);
      const headers = getRateLimitHeaders(rateLimitResult.status);

      console.log(`[PRO API Grok] Rate limited: user=${userId}, model=${model}, reason=${rateLimitResult.status.block_reason}`);

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

    // Note: Live Search API is deprecated as of Dec 15, 2025
    // Web search is now handled through the new Agent Tools API
    // For now, we'll disable search_parameters to avoid 422 errors
    // TODO: Implement Agent Tools API for web search
    // if (enableWebSearch) {
    //   requestBody.search_parameters = {
    //     mode: "auto",
    //     sources: ["web", "x"],
    //     max_search_results: 20,
    //     return_citations: true,
    //   };
    // }

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

    // BYOK: Use user's API key
    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userApiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    // Security: Clear API key from memory after use
    userApiKey = null;

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;

      // Log error details for debugging
      // SECURITY: Only log non-sensitive fields, not user message content which may contain PII
      console.error('Grok API Error:', {
        status: response.status,
        statusText: response.statusText,
        errorData,
        model: requestBody.model,
        messageCount: requestBody.messages?.length,
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
    console.log(`[PRO API Grok] User ${userId} | Model: ${model} | Tokens: ${usage.total_tokens} | Latency: ${latency}ms`);

    // Record usage for rate limiting
    await recordUsage(supabase, userId, model, usage.total_tokens);

    // Get updated rate limit status for headers
    const updatedRateLimitResult = await checkRateLimit(supabase, userId, userTier, model);
    const rateLimitHeaders = getRateLimitHeaders(updatedRateLimitResult.status);

    return NextResponse.json(
      {
        content: reply,
        usage: {
          input_tokens: usage.prompt_tokens,
          output_tokens: usage.completion_tokens,
          total_tokens: usage.total_tokens,
        },
        // Include warning if approaching limit
        rateLimitWarning: updatedRateLimitResult.status.warning_message,
      },
      { headers: rateLimitHeaders }
    );
  } catch (error: any) {
    // Security: Ensure API key is cleared even on error
    userApiKey = null;

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
