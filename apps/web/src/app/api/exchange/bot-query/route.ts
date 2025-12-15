/**
 * Exchange Bot-to-Bot Query API
 *
 * POST /api/exchange/bot-query - Send a single query from user's chatbot to a posted chatbot
 *
 * SECURITY:
 * - Uses QUERYING USER's API key (via getProviderKey)
 * - Uses TARGET POST's chatbot config (system_prompt, model)
 * - Single query only (no multi-turn conversation)
 * - Rate limited to prevent abuse
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { getProviderKey } from '@/lib/secretManager/getKey';
import type { ChatbotFileProvider } from '@/types/chatbotFile';

// Rate limit: 10 bot-to-bot queries per day per user
const BOT_QUERY_DAILY_LIMIT = 10;

// Map our internal model names to Claude API model names
const CLAUDE_API_MODEL_MAP: Record<string, string> = {
  'claude-sonnet-4-5': 'claude-sonnet-4-5-20250929',
  'claude-sonnet-4': 'claude-sonnet-4-20250514',
  'claude-opus-4-1': 'claude-opus-4-1-20250805',
  'claude-haiku-4-5': 'claude-haiku-4-5-20251001',
  'claude-haiku-3-5': 'claude-3-5-haiku-20241022',
};

/**
 * POST - Send a bot-to-bot query
 */
export async function POST(req: NextRequest) {
  let userApiKey: string | null = null;

  try {
    const body = await req.json();
    const { target_post_id, query, context } = body;

    if (!target_post_id) {
      return NextResponse.json(
        { error: 'Target post ID is required' },
        { status: 400 }
      );
    }

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

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

    const userTier = profile.tier as string;
    if (userTier === 'expired' || userTier === 'pending') {
      return NextResponse.json(
        { error: 'Active subscription required for bot-to-bot queries' },
        { status: 403 }
      );
    }

    // Check daily rate limit
    const today = new Date().toISOString().split('T')[0];
    const { count: todayCount } = await supabase
      .from('exchange_bot_queries')
      .select('id', { count: 'exact', head: true })
      .eq('source_user_id', userId)
      .gte('created_at', `${today}T00:00:00Z`);

    if ((todayCount || 0) >= BOT_QUERY_DAILY_LIMIT) {
      return NextResponse.json(
        {
          error: `Daily limit reached (${BOT_QUERY_DAILY_LIMIT} queries per day)`,
          rateLimited: true,
        },
        { status: 429 }
      );
    }

    // Fetch target post
    const { data: post, error: postError } = await supabase
      .from('exchange_posts')
      .select('id, title, chatbot_file')
      .eq('id', target_post_id)
      .eq('is_published', true)
      .single();

    if (postError || !post) {
      return NextResponse.json(
        { error: 'Target post not found' },
        { status: 404 }
      );
    }

    if (!post.chatbot_file) {
      return NextResponse.json(
        { error: 'Target post does not contain a chatbot' },
        { status: 400 }
      );
    }

    // Get the chatbot config from the post
    const chatbotConfig = post.chatbot_file?.config;
    if (!chatbotConfig) {
      return NextResponse.json(
        { error: 'Chatbot configuration not found' },
        { status: 400 }
      );
    }

    const provider = chatbotConfig.model?.provider as ChatbotFileProvider;
    const modelName = chatbotConfig.model?.model_name;
    const systemPrompt = chatbotConfig.system_prompt;

    if (!provider || !modelName) {
      return NextResponse.json(
        { error: 'Invalid chatbot configuration' },
        { status: 400 }
      );
    }

    // BYOK: Get querying user's API key for the provider
    userApiKey = await getProviderKey(userId, provider);
    if (!userApiKey) {
      const providerNames: Record<ChatbotFileProvider, string> = {
        openai: 'OpenAI',
        claude: 'Claude (Anthropic)',
        grok: 'Grok (xAI)',
        gemini: 'Gemini (Google)',
      };

      return NextResponse.json(
        {
          error: 'API key required',
          message: `Please configure your ${providerNames[provider]} API key in Settings to query this chatbot.`,
          code: 'BYOK_KEY_MISSING',
          provider,
        },
        { status: 403 }
      );
    }

    // Build the query message (optionally with context)
    const fullQuery = context
      ? `Context from my conversation:\n${context}\n\nMy question: ${query}`
      : query;

    // Make API call based on provider
    let response: string;
    let tokensUsed = 0;

    if (provider === 'openai') {
      const result = await callOpenAI(userApiKey, modelName, systemPrompt, fullQuery);
      response = result.content;
      tokensUsed = result.tokensUsed;
    } else if (provider === 'claude') {
      const result = await callClaude(userApiKey, modelName, systemPrompt, fullQuery);
      response = result.content;
      tokensUsed = result.tokensUsed;
    } else if (provider === 'grok') {
      const result = await callGrok(userApiKey, modelName, systemPrompt, fullQuery);
      response = result.content;
      tokensUsed = result.tokensUsed;
    } else if (provider === 'gemini') {
      const result = await callGemini(userApiKey, modelName, systemPrompt, fullQuery);
      response = result.content;
      tokensUsed = result.tokensUsed;
    } else {
      userApiKey = null;
      return NextResponse.json(
        { error: `Unsupported provider: ${provider}` },
        { status: 400 }
      );
    }

    // Security: Clear API key from memory after use
    userApiKey = null;

    // Record the query
    await supabase.from('exchange_bot_queries').insert({
      source_user_id: userId,
      target_post_id,
      query: fullQuery,
      response,
      tokens_used: tokensUsed,
    });

    console.log(`[POST /api/exchange/bot-query] User ${userId} queried post ${target_post_id} | Tokens: ${tokensUsed}`);

    // Get remaining queries for today
    const remainingQueries = BOT_QUERY_DAILY_LIMIT - ((todayCount || 0) + 1);

    return NextResponse.json({
      success: true,
      response,
      tokens_used: tokensUsed,
      remaining_queries: remainingQueries,
      chatbot_name: post.title,
    });
  } catch (error: any) {
    // Security: Ensure API key is cleared even on error
    userApiKey = null;

    console.error('[POST /api/exchange/bot-query] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Call OpenAI API
 */
async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  query: string
): Promise<{ content: string; tokensUsed: number }> {
  const openai = new OpenAI({ apiKey });

  const completion = await openai.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: query },
    ],
  });

  const content = completion.choices?.[0]?.message?.content || '';
  const tokensUsed = completion.usage?.total_tokens || 0;

  return { content, tokensUsed };
}

/**
 * Call Claude API
 */
async function callClaude(
  apiKey: string,
  model: string,
  systemPrompt: string,
  query: string
): Promise<{ content: string; tokensUsed: number }> {
  const apiModel = CLAUDE_API_MODEL_MAP[model] || model;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: apiModel,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: query }],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Claude API error: ${response.statusText}`);
  }

  const data = await response.json();
  const textBlocks = data.content?.filter((block: any) => block.type === 'text') || [];
  const content = textBlocks.map((block: any) => block.text).join('\n\n');
  const tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);

  return { content, tokensUsed };
}

/**
 * Call Grok API (xAI - OpenAI-compatible)
 */
async function callGrok(
  apiKey: string,
  model: string,
  systemPrompt: string,
  query: string
): Promise<{ content: string; tokensUsed: number }> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: query },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Grok API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';
  const tokensUsed = data.usage?.total_tokens || 0;

  return { content, tokensUsed };
}

/**
 * Call Gemini API
 */
async function callGemini(
  apiKey: string,
  model: string,
  systemPrompt: string,
  query: string
): Promise<{ content: string; tokensUsed: number }> {
  const geminiModel = model.startsWith('gemini-') ? model : `gemini-${model}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: query }] }],
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          maxOutputTokens: 4096,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Gemini API error: ${response.statusText}`);
  }

  const data = await response.json();
  const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

  return { content, tokensUsed };
}
