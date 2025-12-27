/**
 * @security-audit-requested
 * AUDIT FOCUS: Gemini API proxy security
 * - Is userId properly authenticated (not just passed in body)? ✅ FIXED
 * - Can an attacker use another user's API key? ✅ FIXED - uses authenticated userId
 * - Is the API key cleared from memory after use?
 * - Are there injection attacks possible via messages/tools?
 * - Can rate limiting be bypassed?
 */

/**
 * Gemini (Google AI) API Proxy (BYOK)
 *
 * This route allows authenticated users to use Gemini models
 * using their own API keys stored in Google Secret Manager.
 * Includes rate limiting and usage tracking.
 *
 * BYOK: Users must configure their Gemini API key in Settings.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  checkRateLimit,
  recordUsage,
  recordRequestTimestamp,
  getRateLimitErrorMessage,
  getRateLimitHeaders,
} from '@/lib/rateLimiting';
import { getProviderKey } from '@/lib/secretManager/getKey';
import { getAuthenticatedUserOrService } from '@/lib/serverAuth';
import { checkAIEnabled } from '@/lib/killSwitches';

// Map our internal model names to Gemini API model names
// Using stable model names (not experimental -exp versions)
const GEMINI_MODEL_MAP: Record<string, string> = {
  'gemini-2.0-flash': 'gemini-2.0-flash',
  'gemini-2.5-flash': 'gemini-2.5-flash',
  'gemini-2.5-pro': 'gemini-2.5-pro',
  'gemini-1.5-pro': 'gemini-1.5-pro',
  'gemini-1.5-flash': 'gemini-1.5-flash',
};

export async function POST(req: NextRequest) {
  // Declare outside try so it can be cleared in catch/finally
  let userApiKey: string | null = null;

  try {
    // Parse body first to get userId for internal service auth
    const body = await req.json();
    const { messages, model = 'gemini-2.0-flash', systemPrompt, userId: bodyUserId } = body;

    // SECURITY: Authenticate user - supports both Bearer token and internal service auth
    const { user, error: authError, isInternalCall } = await getAuthenticatedUserOrService(req, bodyUserId);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authError || 'Authentication required' },
        { status: 401 }
      );
    }
    const userId = user.id; // Use authenticated user ID

    // KILL SWITCH: Check if AI features are enabled
    const aiCheck = await checkAIEnabled();
    if (!aiCheck.enabled) {
      return NextResponse.json(
        { error: aiCheck.error!.message },
        { status: aiCheck.error!.status }
      );
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

    // BYOK: Get user's Gemini API key from Secret Manager
    userApiKey = await getProviderKey(userId, 'gemini');
    if (!userApiKey) {
      return NextResponse.json(
        {
          error: 'API key required',
          message: 'Please configure your Gemini API key in Settings to use this model.',
          code: 'BYOK_KEY_MISSING',
        },
        { status: 403 }
      );
    }

    // Rate limiting check (uses tier-specific limits)
    // Skip burst limit for internal service calls (workflow execution makes multiple rapid calls)
    console.log(`[API Gemini] Checking rate limit for user=${userId}, tier=${userTier}, model=${model}, isInternalCall=${!!isInternalCall}`);
    const rateLimitResult = await checkRateLimit(supabase, userId, userTier, model, {
      skipBurstLimit: isInternalCall,
    });

    if (!rateLimitResult.allowed) {
      const errorMessage = getRateLimitErrorMessage(rateLimitResult.status);
      const headers = getRateLimitHeaders(rateLimitResult.status);

      console.log(`[PRO API Gemini] Rate limited: user=${userId}, model=${model}, reason=${rateLimitResult.status.block_reason}`);

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
    await recordRequestTimestamp(supabase, userId, model);

    // Get the actual Gemini API model name
    const apiModel = GEMINI_MODEL_MAP[model] || model;

    // BYOK: Initialize Gemini client with user's API key
    const genAI = new GoogleGenerativeAI(userApiKey);
    const geminiModel = genAI.getGenerativeModel({ model: apiModel });

    // Convert messages to Gemini format
    // Gemini uses { role: 'user' | 'model', parts: [{ text: string }] }
    const geminiMessages = messages
      .filter((m: any) => m.role !== 'system') // Filter out system messages
      .map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
      }));

    // Extract system prompt from messages or use provided one
    const systemMessages = messages.filter((m: any) => m.role === 'system');
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

    // Make request to Gemini
    const startTime = Date.now();

    // Start chat with history (excluding the last user message)
    // systemInstruction must be a Content object, not a plain string
    const chat = geminiModel.startChat({
      history: geminiMessages.slice(0, -1),
      ...(finalSystemPrompt
        ? {
            systemInstruction: {
              role: 'user',
              parts: [{ text: finalSystemPrompt }],
            },
          }
        : {}),
    });

    // Send the last message
    const lastMessage = geminiMessages[geminiMessages.length - 1];
    const result = await chat.sendMessage(lastMessage.parts[0].text);

    // Security: Clear API key from memory after use
    userApiKey = null;

    const response = result.response;
    const reply = response.text();

    if (!reply) {
      throw new Error('No response from Gemini');
    }

    // Extract token usage (Gemini provides usage metadata)
    const usageMetadata = response.usageMetadata;
    const usage = {
      prompt_tokens: usageMetadata?.promptTokenCount || 0,
      completion_tokens: usageMetadata?.candidatesTokenCount || 0,
      total_tokens: usageMetadata?.totalTokenCount || 0,
    };

    const latency = Date.now() - startTime;

    // Log usage for cost tracking
    console.log(`[PRO API Gemini] User ${userId} | Model: ${model} | Tokens: ${usage.total_tokens} | Latency: ${latency}ms`);

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

    console.error('Error in /api/pro/gemini:', error);

    // Handle Gemini API errors
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
