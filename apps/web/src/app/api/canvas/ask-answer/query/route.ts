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
import {
  getEnabledSlackTools,
  toClaudeToolFormat as slackToClaudeToolFormat,
  generateSlackSystemPrompt,
} from '@/app/canvas/features/slack-oauth/lib/slackTools';
import {
  getEnabledCalendarTools,
  toClaudeToolFormat as calendarToClaudeToolFormat,
  generateCalendarSystemPrompt,
} from '@/app/canvas/features/calendar-oauth';
// Import server-side executors directly (uses googleapis/@slack, server-only)
import { executeGmailToolCallsServer } from '@/app/canvas/features/gmail-oauth/lib/gmailToolExecutorServer';
import { executeSheetsToolCallsServer } from '@/app/canvas/features/sheets-oauth/lib/sheetsToolExecutorServer';
import { executeDocsToolCallsServer } from '@/app/canvas/features/docs-oauth/lib/docsToolExecutorServer';
import { executeSlackToolCallsServer } from '@/app/canvas/features/slack-oauth/lib/slackToolExecutorServer';
import { executeCalendarToolCallsServer } from '@/app/canvas/features/calendar-oauth/lib/calendarToolExecutorServer';
// Import OAuth connection lookup for fallback when connectionId not in config
import { getOAuthConnection } from '@/lib/googleTokenStorage';
import { getSlackConnection } from '@/lib/slackTokenStorage';
import { buildInternalApiUrl } from '@/lib/internalApiUrl';

interface ConversationHistoryEntry {
  id: string;
  query: string;
  answer: string;
  timestamp: string;
}

// Uploaded attachment from dashboard/workflow
interface UploadedAttachment {
  name: string;
  type: string; // MIME type
  size: number;
  content: string; // base64 content
  isImage: boolean;
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
  uploadedAttachments?: UploadedAttachment[]; // Files uploaded by user in dashboard
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  // Forward auth header for internal API calls
  const authHeader = request.headers.get('authorization');

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
      uploadedAttachments = [],
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

    // DEBUG: Log all keys in toNodeConfig to see what integrations are present
    console.log(`[Ask/Answer] toNodeConfig keys:`, Object.keys(toNodeConfig));
    console.log(`[Ask/Answer] toNodeConfig.calendar raw:`, toNodeConfig.calendar);

    // Check if target node has Gmail integration enabled
    const gmailConfig = toNodeConfig.gmail;
    let gmailConnectionId = gmailConfig?.connectionId;
    let gmailTools: any[] = [];
    let gmailSystemPrompt = '';
    let effectiveGmailConfig = gmailConfig;

    // Always try to look up the Google OAuth connection
    // This ensures we can send emails even if the node doesn't have Gmail explicitly configured
    try {
      const googleConnection = await getOAuthConnection(userId, 'google');
      if (googleConnection) {
        // Use the Google OAuth connection ID
        if (!gmailConnectionId) {
          gmailConnectionId = googleConnection.id;
          console.log(`[Ask/Answer] Found Google OAuth connection for Gmail: ${gmailConnectionId}`);
        }

        // Use full permissions if Gmail is not enabled or doesn't allow sending
        // This ensures email sending works when user has connected their Google account
        if (!gmailConfig?.enabled || !gmailConfig?.permissions?.canSend) {
          console.log(`[Ask/Answer] Gmail not fully configured, using full permissions as fallback`);
          effectiveGmailConfig = {
            enabled: true,
            connectionId: gmailConnectionId,
            permissions: {
              canRead: true,
              canSend: true,
              canSearch: true,
              canManageLabels: true,
              canManageDrafts: true,
            },
            requireConfirmation: false,
            maxEmailsPerHour: 50,
          };
        }
      }
    } catch (error) {
      console.log(`[Ask/Answer] Failed to lookup Google OAuth connection for Gmail:`, error);
    }

    const hasGmailTools = effectiveGmailConfig?.enabled && gmailConnectionId;

    console.log(`[Ask/Answer] Gmail config:`, {
      enabled: gmailConfig?.enabled,
      connectionId: gmailConfig?.connectionId,
      resolvedConnectionId: gmailConnectionId,
      hasGmailTools,
      usingFallbackConfig: effectiveGmailConfig !== gmailConfig,
      permissions: effectiveGmailConfig?.permissions
    });

    if (hasGmailTools) {
      const enabledTools = getEnabledGmailTools(effectiveGmailConfig!.permissions);
      if (enabledTools.length > 0) {
        gmailTools = gmailToClaudeToolFormat(enabledTools);
        gmailSystemPrompt = generateGmailSystemPrompt(effectiveGmailConfig!);
        console.log(`[Ask/Answer] Gmail tools enabled: ${enabledTools.map(t => t.name).join(', ')}`);
      }
    }

    // Check if target node has Sheets integration enabled
    // Sheets uses same Google OAuth as Gmail, so check if either connectionId is set
    const sheetsConfig = toNodeConfig.sheets;
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

    // Check if target node has Slack integration enabled
    const slackConfig = toNodeConfig.slack;
    let slackConnectionId = slackConfig?.connectionId;
    let slackTools: any[] = [];
    let slackSystemPrompt = '';

    // If Slack is enabled but no connectionId, try to look up the Slack OAuth connection directly
    if (slackConfig?.enabled && !slackConnectionId) {
      try {
        const slackConnection = await getSlackConnection(userId);
        if (slackConnection) {
          slackConnectionId = slackConnection.id;
          console.log(`[Ask/Answer] Found Slack OAuth connection: ${slackConnectionId}`);
        }
      } catch (error) {
        console.log(`[Ask/Answer] Failed to lookup Slack OAuth connection:`, error);
      }
    }

    const hasSlackTools = slackConfig?.enabled && slackConnectionId;

    console.log(`[Ask/Answer] Slack config:`, {
      enabled: slackConfig?.enabled,
      connectionId: slackConfig?.connectionId,
      resolvedConnectionId: slackConnectionId,
      hasSlackTools,
      permissions: slackConfig?.permissions
    });

    if (hasSlackTools) {
      const enabledTools = getEnabledSlackTools(slackConfig.permissions);
      if (enabledTools.length > 0) {
        slackTools = slackToClaudeToolFormat(enabledTools);
        slackSystemPrompt = generateSlackSystemPrompt(slackConfig);
        console.log(`[Ask/Answer] Slack tools enabled: ${enabledTools.map(t => t.name).join(', ')}`);
      }
    }

    // Check if target node has Calendar integration enabled
    // Calendar uses same Google OAuth as Gmail/Sheets/Docs
    const calendarConfig = toNodeConfig.calendar;
    let calendarConnectionId = calendarConfig?.connectionId || gmailConnectionId || sheetsConnectionId;
    let calendarTools: any[] = [];
    let calendarSystemPrompt = '';

    // Only look up Google OAuth connection if Calendar is EXPLICITLY enabled but missing connectionId
    // This ensures we don't auto-enable Calendar just because Gmail is connected
    if (calendarConfig?.enabled && !calendarConnectionId) {
      try {
        const googleConnection = await getOAuthConnection(userId, 'google');
        if (googleConnection) {
          calendarConnectionId = googleConnection.id;
          console.log(`[Ask/Answer] Found Google OAuth connection for Calendar: ${calendarConnectionId}`);
        }
      } catch (error) {
        console.log(`[Ask/Answer] Failed to lookup Google OAuth connection for Calendar:`, error);
      }
    }

    const hasCalendarTools = calendarConfig?.enabled && calendarConnectionId;

    console.log(`[Ask/Answer] Calendar config:`, {
      enabled: calendarConfig?.enabled,
      connectionId: calendarConfig?.connectionId,
      resolvedConnectionId: calendarConnectionId,
      hasCalendarTools,
      permissions: calendarConfig?.permissions
    });

    if (hasCalendarTools && calendarConfig) {
      const enabledTools = getEnabledCalendarTools(calendarConfig.permissions);
      if (enabledTools.length > 0) {
        calendarTools = calendarToClaudeToolFormat(enabledTools);
        calendarSystemPrompt = generateCalendarSystemPrompt(calendarConfig.permissions);
        console.log(`[Ask/Answer] Calendar tools enabled: ${enabledTools.map(t => t.name).join(', ')}`);
      }
    }

    // Combine all tools
    const allTools = [...gmailTools, ...sheetsTools, ...docsTools, ...slackTools, ...calendarTools];

    // Build context for Node B
    // Node B receives the query with context about Node A
    let systemPrompt = `${toNodeConfig.system_prompt}

CONTEXT: You are receiving questions from another AI agent (${fromNodeConfig.name}).
You are having an ongoing conversation with this agent. Use the conversation history to provide contextually relevant responses.
Remember previous exchanges and build upon them when answering follow-up questions.

IMPORTANT: When asked to perform an action (send a message, read emails, etc.), you MUST actually call the appropriate tool. Do NOT claim you have performed an action based on conversation history - always execute the tool for the current request. Each request is a new action that requires a fresh tool call.`;

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

    // Add Slack capabilities to system prompt if enabled
    if (slackSystemPrompt) {
      systemPrompt += `\n\n${slackSystemPrompt}`;
    }

    // Add Calendar capabilities to system prompt if enabled
    if (calendarSystemPrompt) {
      systemPrompt += `\n\n${calendarSystemPrompt}`;
    }

    // Add context about uploaded attachments if present
    if (uploadedAttachments.length > 0) {
      const attachmentList = uploadedAttachments.map((a, i) =>
        `  ${i + 1}. "${a.name}" (${a.type}, ${Math.round(a.size / 1024)}KB)`
      ).join('\n');
      systemPrompt += `\n\nIMPORTANT - UPLOADED FILES: The user has uploaded the following files with their message:
${attachmentList}

CRITICAL: When sending emails (gmail_send) or creating drafts (gmail_draft) and the user wants to attach these files, you MUST set "includeUploadedAttachments": true in your tool call. Without this parameter, the attachments will NOT be included in the email.`;
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
    console.log(`  Slack Tools: ${hasSlackTools ? slackTools.length : 0}`);
    console.log(`  Calendar Tools: ${hasCalendarTools ? calendarTools.length : 0}`);
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

    // SECURITY: Build internal API URL with validation to prevent SSRF
    // Uses only env vars, never request-derived values
    const apiUrl = buildInternalApiUrl(apiEndpoint);

    // Build headers - include auth if available (for BYOK key access)
    const apiHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (authHeader) {
      apiHeaders['Authorization'] = authHeader;
    }

    // Make initial API call
    let apiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: apiHeaders,
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
    // Supports both Claude format (stop_reason: 'tool_use', contentBlocks) and OpenAI format (toolCalls)
    const maxToolIterations = 5;
    let iteration = 0;

    // Check for tool calls - either Claude or OpenAI format
    // The condition is re-evaluated each iteration
    while (iteration < maxToolIterations) {
      const hasClaudeToolUse = apiData.stop_reason === 'tool_use' && apiData.contentBlocks;
      const hasOpenAIToolCalls = apiData.toolCalls && apiData.toolCalls.length > 0;

      if (!hasClaudeToolUse && !hasOpenAIToolCalls) {
        break; // No more tool calls
      }
      iteration++;
      console.log(`[Ask/Answer] Tool use iteration ${iteration}`);

      // Extract tool calls from response - handle both formats
      let toolUseBlocks: Array<{ id: string; name: string; input: any }> = [];

      if (apiData.contentBlocks) {
        // Claude format
        toolUseBlocks = apiData.contentBlocks
          .filter((b: any) => b.type === 'tool_use')
          .map((b: any) => ({ id: b.id, name: b.name, input: b.input }));
      } else if (apiData.toolCalls) {
        // OpenAI format (already converted in the API route)
        toolUseBlocks = apiData.toolCalls;
      }

      // Separate Gmail, Sheets, Docs, Slack, and Calendar tool calls
      const gmailToolCalls = toolUseBlocks.filter((b: any) => b.name?.startsWith('gmail_'));
      const sheetsToolCalls = toolUseBlocks.filter((b: any) => b.name?.startsWith('sheets_'));
      const docsToolCalls = toolUseBlocks.filter((b: any) => b.name?.startsWith('docs_'));
      const slackToolCalls = toolUseBlocks.filter((b: any) => b.name?.startsWith('slack_'));
      const calendarToolCalls = toolUseBlocks.filter((b: any) => b.name?.startsWith('calendar_'));

      // AUTO-INJECT includeUploadedAttachments for gmail_send/gmail_draft when user uploaded files
      // This ensures attachments are included even if the AI forgets to set the flag
      if (uploadedAttachments && uploadedAttachments.length > 0) {
        gmailToolCalls.forEach((toolCall: any) => {
          if (toolCall.name === 'gmail_send' || toolCall.name === 'gmail_draft') {
            if (!toolCall.input.includeUploadedAttachments) {
              console.log(`[Ask/Answer] Auto-injecting includeUploadedAttachments=true for ${toolCall.name} (${uploadedAttachments.length} files uploaded)`);
              toolCall.input.includeUploadedAttachments = true;
            }
          }
        });
      }

      if (gmailToolCalls.length === 0 && sheetsToolCalls.length === 0 && docsToolCalls.length === 0 && slackToolCalls.length === 0 && calendarToolCalls.length === 0) {
        // No tools to execute, break out
        console.log(`[Ask/Answer] No Gmail/Sheets/Docs/Slack/Calendar tools in tool_use response, using text content`);
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
          effectiveGmailConfig!.permissions,
          uploadedAttachments // Pass uploaded attachments for email attachment support
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

      // Execute Slack tools if any
      if (slackToolCalls.length > 0 && hasSlackTools) {
        console.log(`[Ask/Answer] Executing ${slackToolCalls.length} Slack tools (server-side)`);
        const slackResults = await executeSlackToolCallsServer(
          slackToolCalls,
          userId,
          toNodeId,
          slackConfig!.permissions
        );
        allToolResults.push(...slackResults);
      }

      // Execute Calendar tools if any
      if (calendarToolCalls.length > 0 && hasCalendarTools && calendarConfig) {
        console.log(`[Ask/Answer] Executing ${calendarToolCalls.length} Calendar tools (server-side)`);
        const calendarResults = await executeCalendarToolCallsServer(
          calendarToolCalls,
          userId,
          toNodeId,
          calendarConfig.permissions
        );
        allToolResults.push(...calendarResults);
      }

      // For OpenAI with tool calls, check for immediate success cases (email sent, event created)
      // and return early if we can provide a direct response
      if (apiData.toolCalls && allToolResults.length > 0) {
        // Find the successful result (likely gmail_send or calendar_create_event)
        const successResult = allToolResults.find(r => !r.isError);
        if (successResult) {
          try {
            const resultData = JSON.parse(successResult.result);
            if (resultData.sent && resultData.messageId) {
              // Email was sent successfully - return confirmation
              const answer = `✅ Email sent successfully!\n\nMessage ID: ${resultData.messageId}${resultData.attachmentCount ? `\nAttachments: ${resultData.attachmentCount}` : ''}`;
              const duration_ms = Date.now() - startTime;
              console.log(`[Ask/Answer] OpenAI email sent successfully in ${duration_ms}ms`);
              return NextResponse.json({
                success: true,
                queryId,
                answer,
                timestamp: new Date().toISOString(),
                duration_ms,
              });
            }
            // Calendar event created successfully
            if (resultData.created && resultData.event) {
              const event = resultData.event;
              const eventStartTime = event.start?.dateTime || event.start?.date || 'TBD';
              const answer = `✅ Calendar event created!\n\n**${event.summary}**\nWhen: ${eventStartTime}${event.location ? `\nWhere: ${event.location}` : ''}${event.htmlLink ? `\n\n[View in Google Calendar](${event.htmlLink})` : ''}`;
              const duration_ms = Date.now() - startTime;
              console.log(`[Ask/Answer] OpenAI calendar event created successfully in ${duration_ms}ms`);
              return NextResponse.json({
                success: true,
                queryId,
                answer,
                timestamp: new Date().toISOString(),
                duration_ms,
              });
            }
          } catch (e) {
            // Continue with normal flow if result parsing fails
          }
        }
      }

      // Format tool results for the next API call
      // For OpenAI, we need to continue the conversation with tool results
      if (apiData.toolCalls) {
        // OpenAI format: Add assistant message with tool_calls, then tool results
        const toolResultMessages = allToolResults.map(result => ({
          role: 'tool' as const,
          tool_call_id: result.toolCallId,
          content: result.result,
        }));

        // Build the assistant message with tool calls (OpenAI format)
        const assistantToolCallMessage = {
          role: 'assistant' as const,
          content: null,
          tool_calls: apiData.toolCalls.map((tc: any) => ({
            id: tc.id,
            type: 'function',
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.input),
            },
          })),
        };

        messages = [
          ...messages,
          assistantToolCallMessage,
          ...toolResultMessages,
        ];

        console.log(`[Ask/Answer] OpenAI: Continuing conversation with ${toolResultMessages.length} tool results`);
      } else {
        // Claude format: Add assistant message with content blocks, then tool results
        const toolResultBlocks = allToolResults.map(result => ({
          type: 'tool_result',
          tool_use_id: result.toolCallId,
          content: result.result,
          is_error: result.isError,
        }));

        messages = [
          ...messages,
          { role: 'assistant', content: apiData.contentBlocks },
          { role: 'user', content: toolResultBlocks },
        ];
      }

      apiResponse = await fetch(apiUrl, {
        method: 'POST',
        headers: apiHeaders,
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
