/**
 * Ask/Answer Query API Route
 *
 * Processes queries from Node A and generates answers using Node B's AI configuration.
 * Properly segmented - doesn't pollute existing API routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { GenesisBotNodeConfig } from '@/app/canvas/types';

interface QueryRequestBody {
  canvasId: string;
  fromNodeId: string;
  toNodeId: string;
  edgeId: string;
  query: string;
  queryId: string;
  userId: string; // User making the request
  fromNodeConfig: GenesisBotNodeConfig;
  toNodeConfig: GenesisBotNodeConfig;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body: QueryRequestBody = await request.json();
    const {
      canvasId,
      fromNodeId,
      toNodeId,
      edgeId,
      query,
      queryId,
      userId,
      fromNodeConfig,
      toNodeConfig,
    } = body;

    // Validation
    if (!query || !fromNodeConfig || !toNodeConfig || !userId) {
      return NextResponse.json(
        {
          success: false,
          queryId,
          error: 'Missing required fields',
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Build context for Node B
    // Node B receives the query with context about Node A
    const systemPrompt = `${toNodeConfig.system_prompt}

CONTEXT: You are receiving a question from another AI agent (${fromNodeConfig.name}).

Question from ${fromNodeConfig.name}: "${query}"

Please provide a helpful, accurate answer based on your capabilities and knowledge.`;

    // Prepare messages for Node B
    const messages = [
      {
        role: 'user' as const,
        content: query,
      },
    ];

    console.log(`[Ask/Answer] Processing query ${queryId}`);
    console.log(`  From: ${fromNodeId} (${fromNodeConfig.name})`);
    console.log(`  To: ${toNodeId} (${toNodeConfig.name})`);
    console.log(`  Model: ${toNodeConfig.model_provider}/${toNodeConfig.model_name}`);

    // Route to appropriate Pro API based on provider
    const provider = toNodeConfig.model_provider;
    const apiEndpoint =
      provider === 'openai' ? '/api/pro/openai' :
      provider === 'claude' ? '/api/pro/claude' :
      provider === 'grok' ? '/api/pro/grok' :
      null;

    if (!apiEndpoint) {
      return NextResponse.json(
        {
          success: false,
          queryId,
          error: `Unsupported provider: ${provider}`,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Call the Pro API route
    const apiUrl = new URL(apiEndpoint, request.url);
    const apiResponse = await fetch(apiUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        messages,
        model: toNodeConfig.model_name,
        systemPrompt,
        temperature: toNodeConfig.temperature,
        maxTokens: toNodeConfig.max_tokens,
        enableWebSearch: toNodeConfig.web_search_enabled !== false, // Use node's web search setting
      }),
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      throw new Error(errorData.error || 'API request failed');
    }

    const apiData = await apiResponse.json();
    const answer = apiData.content || apiData.message || '';
    const duration_ms = Date.now() - startTime;

    console.log(`[Ask/Answer] Query completed in ${duration_ms}ms`);

    return NextResponse.json({
      success: true,
      queryId,
      answer,
      timestamp: new Date().toISOString(),
      duration_ms,
    });
  } catch (error) {
    console.error('[Ask/Answer API] Error processing query:', error);

    const duration_ms = Date.now() - startTime;

    return NextResponse.json(
      {
        success: false,
        queryId: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
        duration_ms,
      },
      { status: 500 }
    );
  }
}
