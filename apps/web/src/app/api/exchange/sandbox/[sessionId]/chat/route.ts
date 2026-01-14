/**
 * Exchange Sandbox Chat API
 *
 * POST /api/exchange/sandbox/[sessionId]/chat - Send a message in sandbox session
 *
 * SECURITY CRITICAL:
 * - Uses TESTER's API key (via getProviderKey)
 * - Uses POSTER's chatbot config (system_prompt, model)
 * - Enforces 30-second rate limit between queries
 * - Clears API key from memory after use
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { getProviderKey } from '@/lib/secretManager/getKey';
import type { ChatbotFileProvider } from '@/types/chatbotFile';
import { withDebug } from '@/lib/debug';

type RouteParams = { params: Promise<{ sessionId: string }> };

// Sandbox rate limit: 30 seconds between queries
const SANDBOX_RATE_LIMIT_SECONDS = 30;

// Map our internal model names to Claude API model names
const CLAUDE_API_MODEL_MAP: Record<string, string> = {
  'claude-sonnet-4-5': 'claude-sonnet-4-5-20250929',
  'claude-sonnet-4': 'claude-sonnet-4-20250514',
  'claude-opus-4-1': 'claude-opus-4-1-20250805',
  'claude-haiku-4-5': 'claude-haiku-4-5-20251001',
  'claude-haiku-3-5': 'claude-3-5-haiku-20241022',
};

interface SandboxMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

/**
 * POST - Send a message in sandbox session
 */
export const POST = withDebug(async (req, sessionId, { params }: RouteParams) => {
  let userApiKey: string | null = null;

  try {
    const { sessionId } = await params;
    const body = await req.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get authenticated user (TESTER)
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

    // Fetch session and verify ownership
    const { data: session, error: sessionError } = await supabase
      .from('exchange_sandbox_sessions')
      .select('*, exchange_posts!inner(id, chatbot_file)')
      .eq('id', sessionId)
      .eq('user_id', userId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      // Clean up expired session
      await supabase
        .from('exchange_sandbox_sessions')
        .delete()
        .eq('id', sessionId);

      return NextResponse.json(
        { error: 'Session has expired' },
        { status: 410 }
      );
    }

    // Rate limit: 30 seconds between queries
    if (session.last_query_at) {
      const lastQueryTime = new Date(session.last_query_at).getTime();
      const now = Date.now();
      const secondsSinceLastQuery = (now - lastQueryTime) / 1000;

      if (secondsSinceLastQuery < SANDBOX_RATE_LIMIT_SECONDS) {
        const waitSeconds = Math.ceil(SANDBOX_RATE_LIMIT_SECONDS - secondsSinceLastQuery);
        return NextResponse.json(
          {
            error: `Please wait ${waitSeconds} seconds between queries`,
            rateLimited: true,
            waitSeconds,
          },
          { status: 429 }
        );
      }
    }

    // Get the chatbot config from the post
    const chatbotConfig = session.exchange_posts?.chatbot_file?.config;
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
        { error: 'Active subscription required to test chatbots' },
        { status: 403 }
      );
    }

    // BYOK: Get TESTER's API key for the provider
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
          message: `Please configure your ${providerNames[provider]} API key in Settings to test this chatbot.`,
          code: 'BYOK_KEY_MISSING',
          provider,
        },
        { status: 403 }
      );
    }

    // Update last_query_at immediately to prevent race conditions
    await supabase
      .from('exchange_sandbox_sessions')
      .update({ last_query_at: new Date().toISOString() })
      .eq('id', sessionId);

    // Build conversation messages from session history
    const previousMessages: SandboxMessage[] = session.messages || [];
    const conversationMessages = previousMessages.map((msg: SandboxMessage) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Add the new user message
    conversationMessages.push({ role: 'user', content: message });

    // Make API call based on provider
    let assistantReply: string;
    let tokensUsed = 0;

    if (provider === 'openai') {
      assistantReply = await callOpenAI(
        userApiKey,
        modelName,
        systemPrompt,
        conversationMessages
      ).then((result) => {
        tokensUsed = result.tokensUsed;
        return result.content;
      });
    } else if (provider === 'claude') {
      assistantReply = await callClaude(
        userApiKey,
        modelName,
        systemPrompt,
        conversationMessages
      ).then((result) => {
        tokensUsed = result.tokensUsed;
        return result.content;
      });
    } else if (provider === 'grok') {
      assistantReply = await callGrok(
        userApiKey,
        modelName,
        systemPrompt,
        conversationMessages
      ).then((result) => {
        tokensUsed = result.tokensUsed;
        return result.content;
      });
    } else if (provider === 'gemini') {
      assistantReply = await callGemini(
        userApiKey,
        modelName,
        systemPrompt,
        conversationMessages
      ).then((result) => {
        tokensUsed = result.tokensUsed;
        return result.content;
      });
    } else {
      userApiKey = null;
      return NextResponse.json(
        { error: `Unsupported provider: ${provider}` },
        { status: 400 }
      );
    }

    // Security: Clear API key from memory after use
    userApiKey = null;

    // Update session with new messages
    const newMessages: SandboxMessage[] = [
      ...previousMessages,
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: assistantReply, timestamp: new Date().toISOString() },
    ];

    const { error: updateError } = await supabase
      .from('exchange_sandbox_sessions')
      .update({
        messages: newMessages,
        last_query_at: new Date().toISOString(),
      })
      .eq('id', sessionId);

    if (updateError) {
      console.error('[POST /api/exchange/sandbox/[sessionId]/chat] Update error:', updateError);
    }

    // Increment test count on the post
    await supabase.rpc('increment_post_test_count', { post_id: session.post_id });

    console.log(`[POST /api/exchange/sandbox/[sessionId]/chat] Session ${sessionId} | Provider: ${provider} | Tokens: ${tokensUsed}`);

    return NextResponse.json({
      success: true,
      message: {
        role: 'assistant',
        content: assistantReply,
        timestamp: new Date().toISOString(),
      },
      usage: {
        tokens: tokensUsed,
      },
    });
  } catch (error: any) {
    // Security: Ensure API key is cleared even on error
    userApiKey = null;

    console.error('[POST /api/exchange/sandbox/[sessionId]/chat] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
});

/**
 * Call OpenAI API
 */
async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>
): Promise<{ content: string; tokensUsed: number }> {
  const openai = new OpenAI({ apiKey });

  const allMessages = [
    { role: 'system' as const, content: systemPrompt },
    ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  const completion = await openai.chat.completions.create({
    model,
    messages: allMessages,
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
  messages: Array<{ role: string; content: string }>
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
      max_tokens: 8192,
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
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
  messages: Array<{ role: string; content: string }>
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
        ...messages,
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
  messages: Array<{ role: string; content: string }>
): Promise<{ content: string; tokensUsed: number }> {
  // Map model names to Gemini API format
  const geminiModel = model.startsWith('gemini-') ? model : `gemini-${model}`;

  // Build conversation content for Gemini
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        generationConfig: {
          maxOutputTokens: 8192,
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
  // Gemini doesn't always return token counts in the same format
  const tokensUsed = data.usageMetadata?.totalTokenCount || 0;

  return { content, tokensUsed };
}
