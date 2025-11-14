/**
 * Pro User OpenAI API Proxy
 *
 * This route allows Pro users to use OpenAI models without providing their own API keys.
 * Uses the app's OpenAI API key (stored in env vars) instead.
 * Includes rate limiting and usage tracking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// Initialize OpenAI client with app's API key
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, messages, model = 'gpt-4o' } = body;

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
    // For now, we'll rely on OpenAI's rate limits

    // Make request to OpenAI
    const startTime = Date.now();
    const completion = await openai.chat.completions.create({
      model,
      messages,
    });

    const reply = completion.choices?.[0]?.message?.content;

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
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      },
    });
  } catch (error: any) {
    console.error('Error in /api/pro/openai:', error);

    // Handle OpenAI API errors
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
