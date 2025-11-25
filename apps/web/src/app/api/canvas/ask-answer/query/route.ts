/**
 * Ask/Answer Query API Route
 *
 * Processes queries from Node A and generates answers using Node B's AI configuration.
 * Properly segmented - doesn't pollute existing API routes.
 * Supports Gmail tool calling for nodes with Gmail integration.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { GenesisBotNodeConfig } from '@/app/canvas/types';
import {
  getEnabledGmailTools,
  toClaudeToolFormat,
  generateGmailSystemPrompt,
} from '@/app/canvas/features/gmail-oauth';
// Import server-side executor directly (uses googleapis, server-only)
import { executeGmailToolCallsServer } from '@/app/canvas/features/gmail-oauth/lib/gmailToolExecutorServer';

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

    // Check if target node has Gmail integration enabled
    const gmailConfig = toNodeConfig.gmail;
    const hasGmailTools = gmailConfig?.enabled && gmailConfig.connectionId;
    let gmailTools: any[] = [];
    let gmailSystemPrompt = '';

    if (hasGmailTools) {
      const enabledTools = getEnabledGmailTools(gmailConfig.permissions);
      if (enabledTools.length > 0) {
        gmailTools = toClaudeToolFormat(enabledTools);
        gmailSystemPrompt = generateGmailSystemPrompt(gmailConfig);
        console.log(`[Ask/Answer] Gmail tools enabled: ${enabledTools.map(t => t.name).join(', ')}`);
      }
    }

    // Build context for Node B
    // Node B receives the query with context about Node A
    let systemPrompt = `${toNodeConfig.system_prompt}

CONTEXT: You are receiving a question from another AI agent (${fromNodeConfig.name}).

Question from ${fromNodeConfig.name}: "${query}"

Please provide a helpful, accurate answer based on your capabilities and knowledge.`;

    // Add Gmail capabilities to system prompt if enabled
    if (gmailSystemPrompt) {
      systemPrompt += `\n\n${gmailSystemPrompt}`;
    }

    // Prepare messages for Node B
    let messages: Array<{ role: string; content: any }> = [
      {
        role: 'user' as const,
        content: query,
      },
    ];

    console.log(`[Ask/Answer] Processing query ${queryId}`);
    console.log(`  From: ${fromNodeId} (${fromNodeConfig.name})`);
    console.log(`  To: ${toNodeId} (${toNodeConfig.name})`);
    console.log(`  Model: ${toNodeConfig.model_provider}/${toNodeConfig.model_name}`);
    console.log(`  Gmail Tools: ${hasGmailTools ? gmailTools.length : 0}`);

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

    const apiUrl = new URL(apiEndpoint, request.url);

    // Make initial API call
    let apiResponse = await fetch(apiUrl.toString(), {
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
        enableWebSearch: toNodeConfig.web_search_enabled !== false,
        tools: gmailTools.length > 0 ? gmailTools : undefined,
      }),
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      throw new Error(errorData.error || 'API request failed');
    }

    let apiData = await apiResponse.json();

    // Handle tool calls (Gmail) - loop until we get a final response
    const maxToolIterations = 5;
    let iteration = 0;

    while (apiData.stop_reason === 'tool_use' && apiData.contentBlocks && iteration < maxToolIterations) {
      iteration++;
      console.log(`[Ask/Answer] Tool use iteration ${iteration}`);

      // Extract tool calls from response
      const toolUseBlocks = apiData.contentBlocks.filter((b: any) => b.type === 'tool_use');
      const gmailToolCalls = toolUseBlocks
        .filter((b: any) => b.name?.startsWith('gmail_'))
        .map((b: any) => ({
          id: b.id,
          name: b.name,
          input: b.input,
        }));

      if (gmailToolCalls.length === 0) {
        // No Gmail tools to execute, break out
        console.log(`[Ask/Answer] No Gmail tools in tool_use response, using text content`);
        break;
      }

      console.log(`[Ask/Answer] Executing ${gmailToolCalls.length} Gmail tools (server-side)`);

      // Execute Gmail tools directly (server-side, no HTTP fetch)
      const toolResults = await executeGmailToolCallsServer(
        gmailToolCalls,
        userId,
        toNodeId,
        gmailConfig!.permissions
      );

      // Format tool results for Claude
      const toolResultBlocks = toolResults.map(result => ({
        type: 'tool_result',
        tool_use_id: result.toolCallId,
        content: result.result,
        is_error: result.isError,
      }));

      // Continue conversation with tool results
      messages = [
        ...messages,
        { role: 'assistant', content: apiData.contentBlocks },
        { role: 'user', content: toolResultBlocks },
      ];

      apiResponse = await fetch(apiUrl.toString(), {
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
          enableWebSearch: toNodeConfig.web_search_enabled !== false,
          tools: gmailTools.length > 0 ? gmailTools : undefined,
        }),
      });

      if (!apiResponse.ok) {
        const errorData = await apiResponse.json();
        throw new Error(errorData.error || 'API request failed during tool loop');
      }

      apiData = await apiResponse.json();
    }

    const answer = apiData.content || apiData.message || '';
    const duration_ms = Date.now() - startTime;

    console.log(`[Ask/Answer] Query completed in ${duration_ms}ms (${iteration} tool iterations)`);

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
