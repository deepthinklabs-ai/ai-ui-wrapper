/**
 * Ask/Answer Query API Route
 *
 * Processes queries from Node A and generates answers using Node B's AI configuration.
 * Properly segmented - doesn't pollute existing API routes.
 * Supports Gmail and Sheets tool calling for nodes with integrations enabled.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { GenesisBotNodeConfig } from '@/app/canvas/types';
import {
  getEnabledGmailTools,
  toClaudeToolFormat as gmailToClaudeToolFormat,
  generateGmailSystemPrompt,
} from '@/app/canvas/features/gmail-oauth';
import {
  getEnabledSheetsTools,
  toClaudeToolFormat as sheetsToClaudeToolFormat,
  generateSheetsSystemPrompt,
} from '@/app/canvas/features/sheets-oauth';
import {
  getEnabledDocsTools,
  toClaudeToolFormat as docsToClaudeToolFormat,
  generateDocsSystemPrompt,
} from '@/app/canvas/features/docs-oauth/lib/docsTools';
// Import server-side executors directly (uses googleapis, server-only)
import { executeGmailToolCallsServer } from '@/app/canvas/features/gmail-oauth/lib/gmailToolExecutorServer';
import { executeSheetsToolCallsServer } from '@/app/canvas/features/sheets-oauth/lib/sheetsToolExecutorServer';
import { executeDocsToolCallsServer } from '@/app/canvas/features/docs-oauth/lib/docsToolExecutorServer';
// Import OAuth connection lookup for fallback when connectionId not in config
import { getOAuthConnection } from '@/lib/googleTokenStorage';

interface ConversationHistoryEntry {
  id: string;
  query: string;
  answer: string;
  timestamp: string;
}

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
  conversationHistory?: ConversationHistoryEntry[]; // Previous Q&A for context
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
      conversationHistory = [],
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
        gmailTools = gmailToClaudeToolFormat(enabledTools);
        gmailSystemPrompt = generateGmailSystemPrompt(gmailConfig);
        console.log(`[Ask/Answer] Gmail tools enabled: ${enabledTools.map(t => t.name).join(', ')}`);
      }
    }

    // Check if target node has Sheets integration enabled
    // Sheets uses same Google OAuth as Gmail, so check if either connectionId is set
    const sheetsConfig = toNodeConfig.sheets;
    const gmailConnectionId = gmailConfig?.connectionId;
    const sheetsConnectionId = sheetsConfig?.connectionId || gmailConnectionId;
    const hasSheetsTools = sheetsConfig?.enabled && sheetsConnectionId;
    let sheetsTools: any[] = [];
    let sheetsSystemPrompt = '';

    console.log(`[Ask/Answer] Sheets config:`, {
      enabled: sheetsConfig?.enabled,
      connectionId: sheetsConfig?.connectionId,
      gmailConnectionId,
      hasSheetsTools,
      permissions: sheetsConfig?.permissions
    });

    if (hasSheetsTools) {
      const enabledTools = getEnabledSheetsTools(sheetsConfig.permissions);
      if (enabledTools.length > 0) {
        sheetsTools = sheetsToClaudeToolFormat(enabledTools);
        sheetsSystemPrompt = generateSheetsSystemPrompt(sheetsConfig);
        console.log(`[Ask/Answer] Sheets tools enabled: ${enabledTools.map(t => t.name).join(', ')}`);
      }
    }

    // Check if target node has Docs integration enabled
    // Docs uses same Google OAuth as Gmail/Sheets
    const docsConfig = toNodeConfig.docs;
    let docsConnectionId = docsConfig?.connectionId || gmailConnectionId || sheetsConnectionId;
    let docsTools: any[] = [];
    let docsSystemPrompt = '';

    // If Docs is enabled but no connectionId, try to look up the Google OAuth connection directly
    if (docsConfig?.enabled && !docsConnectionId) {
      try {
        const googleConnection = await getOAuthConnection(userId, 'google');
        if (googleConnection) {
          docsConnectionId = googleConnection.id;
          console.log(`[Ask/Answer] Found Google OAuth connection for Docs: ${docsConnectionId}`);
        }
      } catch (error) {
        console.log(`[Ask/Answer] Failed to lookup Google OAuth connection:`, error);
      }
    }

    const hasDocsTools = docsConfig?.enabled && docsConnectionId;

    console.log(`[Ask/Answer] Docs config:`, {
      enabled: docsConfig?.enabled,
      connectionId: docsConfig?.connectionId,
      resolvedConnectionId: docsConnectionId,
      hasDocsTools,
      permissions: docsConfig?.permissions
    });

    if (hasDocsTools) {
      const enabledTools = getEnabledDocsTools(docsConfig.permissions);
      if (enabledTools.length > 0) {
        docsTools = docsToClaudeToolFormat(enabledTools);
        docsSystemPrompt = generateDocsSystemPrompt(docsConfig);
        console.log(`[Ask/Answer] Docs tools enabled: ${enabledTools.map(t => t.name).join(', ')}`);
      }
    }

    // Combine all tools
    const allTools = [...gmailTools, ...sheetsTools, ...docsTools];

    // Build context for Node B
    // Node B receives the query with context about Node A
    let systemPrompt = `${toNodeConfig.system_prompt}

CONTEXT: You are receiving questions from another AI agent (${fromNodeConfig.name}).
You are having an ongoing conversation with this agent. Use the conversation history to provide contextually relevant responses.
Remember previous exchanges and build upon them when answering follow-up questions.`;

    // Add Gmail capabilities to system prompt if enabled
    if (gmailSystemPrompt) {
      systemPrompt += `\n\n${gmailSystemPrompt}`;
    }

    // Add Sheets capabilities to system prompt if enabled
    if (sheetsSystemPrompt) {
      systemPrompt += `\n\n${sheetsSystemPrompt}`;
    }

    // Add Docs capabilities to system prompt if enabled
    if (docsSystemPrompt) {
      systemPrompt += `\n\n${docsSystemPrompt}`;
    }

    // Build messages array with conversation history
    // Each history entry becomes a user/assistant message pair
    let messages: Array<{ role: string; content: any }> = [];

    // Add conversation history as context
    if (conversationHistory.length > 0) {
      console.log(`[Ask/Answer] Including ${conversationHistory.length} previous exchanges for context`);

      for (const entry of conversationHistory) {
        // Add the previous query as user message
        messages.push({
          role: 'user',
          content: entry.query,
        });
        // Add the previous answer as assistant message
        messages.push({
          role: 'assistant',
          content: entry.answer,
        });
      }
    }

    // Add the current query
    messages.push({
      role: 'user',
      content: query,
    });

    console.log(`[Ask/Answer] Processing query ${queryId}`);
    console.log(`  From: ${fromNodeId} (${fromNodeConfig.name})`);
    console.log(`  To: ${toNodeId} (${toNodeConfig.name})`);
    console.log(`  Model: ${toNodeConfig.model_provider}/${toNodeConfig.model_name}`);
    console.log(`  History: ${conversationHistory.length} previous exchanges`);
    console.log(`  Total Messages: ${messages.length}`);
    console.log(`  Gmail Tools: ${hasGmailTools ? gmailTools.length : 0}`);
    console.log(`  Sheets Tools: ${hasSheetsTools ? sheetsTools.length : 0}`);
    console.log(`  Docs Tools: ${hasDocsTools ? docsTools.length : 0}`);
    console.log(`  Total Tools: ${allTools.length}`);

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
        tools: allTools.length > 0 ? allTools : undefined,
      }),
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      throw new Error(errorData.error || 'API request failed');
    }

    let apiData = await apiResponse.json();

    // Handle tool calls (Gmail & Sheets) - loop until we get a final response
    const maxToolIterations = 5;
    let iteration = 0;

    while (apiData.stop_reason === 'tool_use' && apiData.contentBlocks && iteration < maxToolIterations) {
      iteration++;
      console.log(`[Ask/Answer] Tool use iteration ${iteration}`);

      // Extract tool calls from response
      const toolUseBlocks = apiData.contentBlocks.filter((b: any) => b.type === 'tool_use');

      // Separate Gmail and Sheets tool calls
      const gmailToolCalls = toolUseBlocks
        .filter((b: any) => b.name?.startsWith('gmail_'))
        .map((b: any) => ({
          id: b.id,
          name: b.name,
          input: b.input,
        }));

      const sheetsToolCalls = toolUseBlocks
        .filter((b: any) => b.name?.startsWith('sheets_'))
        .map((b: any) => ({
          id: b.id,
          name: b.name,
          input: b.input,
        }));

      const docsToolCalls = toolUseBlocks
        .filter((b: any) => b.name?.startsWith('docs_'))
        .map((b: any) => ({
          id: b.id,
          name: b.name,
          input: b.input,
        }));

      if (gmailToolCalls.length === 0 && sheetsToolCalls.length === 0 && docsToolCalls.length === 0) {
        // No tools to execute, break out
        console.log(`[Ask/Answer] No Gmail/Sheets/Docs tools in tool_use response, using text content`);
        break;
      }

      const allToolResults: Array<{ toolCallId: string; result: string; isError: boolean }> = [];

      // Execute Gmail tools if any
      if (gmailToolCalls.length > 0 && hasGmailTools) {
        console.log(`[Ask/Answer] Executing ${gmailToolCalls.length} Gmail tools (server-side)`);
        const gmailResults = await executeGmailToolCallsServer(
          gmailToolCalls,
          userId,
          toNodeId,
          gmailConfig!.permissions
        );
        allToolResults.push(...gmailResults);
      }

      // Execute Sheets tools if any
      if (sheetsToolCalls.length > 0 && hasSheetsTools) {
        console.log(`[Ask/Answer] Executing ${sheetsToolCalls.length} Sheets tools (server-side)`);
        const sheetsResults = await executeSheetsToolCallsServer(
          sheetsToolCalls,
          userId,
          toNodeId,
          sheetsConfig!.permissions
        );
        allToolResults.push(...sheetsResults);
      }

      // Execute Docs tools if any
      if (docsToolCalls.length > 0 && hasDocsTools) {
        console.log(`[Ask/Answer] Executing ${docsToolCalls.length} Docs tools (server-side)`);
        const docsResults = await executeDocsToolCallsServer(
          docsToolCalls,
          userId,
          toNodeId,
          docsConfig!.permissions
        );
        allToolResults.push(...docsResults);
      }

      // Format tool results for Claude
      const toolResultBlocks = allToolResults.map(result => ({
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
          tools: allTools.length > 0 ? allTools : undefined,
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
