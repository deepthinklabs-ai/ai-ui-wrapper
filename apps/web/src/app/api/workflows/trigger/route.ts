/**
 * POST /api/workflows/trigger
 *
 * Triggers a workflow by executing from a Master Trigger node.
 * Supports direct Genesis Bot connections, Smart Router fan-out, and Response Compiler aggregation.
 *
 * Workflow patterns:
 * 1. Simple: Master Trigger → Genesis Bot
 * 2. Advanced: Master Trigger → Smart Router → [Gmail Agent, Calendar Agent, ...] → Response Compiler
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type {
  TriggerWorkflowRequest,
  MasterTriggerOutput,
} from '@/app/canvas/features/master-trigger/types';
import type {
  GenesisBotNodeConfig,
  SmartRouterNodeConfig,
  ResponseCompilerNodeConfig,
  CanvasEdge,
  CanvasNode,
  ConnectedAgentInfo,
  IntegrationType,
} from '@/app/canvas/types';
import { validateTriggerInput, sanitizeMessage } from '@/app/canvas/features/master-trigger/lib/validation';
import { executeSmartRouter } from '@/app/canvas/features/smart-router';
import { executeResponseCompiler } from '@/app/canvas/features/response-compiler';
import type { AgentResponse } from '@/app/canvas/features/response-compiler/types';
import { getInternalBaseUrl, getVercelBypassHeaders } from '@/lib/internalApiUrl';
import { INTERNAL_SERVICE_AUTH_HEADER } from '@/lib/serverAuth';
import type { NodeExecutionState, ExecutionLogEntry } from '@/app/canvas/types';

// Lazy Supabase client - created on first use to avoid module-level crashes
// Note: Returns 'any' to bypass strict typing for tables not in generated types
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase(): any {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('Missing Supabase environment variables');
    }
    _supabase = createClient(url, key);
  }
  return _supabase;
}

/**
 * Build ConnectedAgentInfo from a Genesis Bot node config
 */
function buildAgentInfo(nodeId: string, config: GenesisBotNodeConfig): ConnectedAgentInfo {
  const integrations: IntegrationType[] = [];
  const capabilities: string[] = [];

  if (config.gmail?.enabled) {
    integrations.push('gmail');
    capabilities.push('Send/read emails via Gmail');
  }
  if (config.calendar?.enabled) {
    integrations.push('calendar');
    capabilities.push('Manage calendar events');
  }
  if (config.sheets?.enabled) {
    integrations.push('sheets');
    capabilities.push('Read/write Google Sheets');
  }
  if (config.docs?.enabled) {
    integrations.push('docs');
    capabilities.push('Read/write Google Docs');
  }
  if (config.slack?.enabled) {
    integrations.push('slack');
    capabilities.push('Send Slack messages');
  }

  if (integrations.length === 0) {
    capabilities.push('General AI assistance');
  }

  return {
    nodeId,
    name: config.name || 'AI Agent',
    integrations,
    capabilities,
  };
}

/**
 * Call Ask/Answer API for a single agent
 */
async function callAgentAskAnswer(
  params: {
    canvasId: string;
    fromNodeId: string;
    toNodeId: string;
    edgeId: string;
    query: string;
    userId: string;
    fromNodeConfig: any;
    toNodeConfig: GenesisBotNodeConfig;
    conversationHistory: Array<{ id: string; query: string; answer: string; timestamp: string }>;
    attachments?: any[];
    internalBaseUrl: string;
    authHeader?: string | null;
  }
): Promise<AgentResponse> {
  const {
    canvasId,
    fromNodeId,
    toNodeId,
    edgeId,
    query,
    userId,
    fromNodeConfig,
    toNodeConfig,
    conversationHistory,
    attachments,
    internalBaseUrl,
    authHeader,
  } = params;

  const agentName = toNodeConfig.name || 'AI Agent';
  const timestamp = new Date().toISOString();

  try {
    const askAnswerUrl = new URL('/api/canvas/ask-answer/query', internalBaseUrl);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...getVercelBypassHeaders(), // Bypass Vercel Deployment Protection
    };
    // Add internal service auth for server-to-server calls
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey) {
      headers[INTERNAL_SERVICE_AUTH_HEADER] = serviceKey;
    }
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    const response = await fetch(askAnswerUrl.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify({
        canvasId,
        fromNodeId,
        toNodeId,
        edgeId,
        query,
        queryId: crypto.randomUUID(),
        userId,
        fromNodeConfig,
        toNodeConfig,
        conversationHistory,
        uploadedAttachments: attachments,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[Workflow] Agent ${agentName} error: ${response.status} - ${errorText}`);
      return {
        nodeId: toNodeId,
        agentName,
        success: false,
        response: '',
        error: `API error: ${response.status}`,
        timestamp,
      };
    }

    const data = await response.json();

    if (!data.success) {
      return {
        nodeId: toNodeId,
        agentName,
        success: false,
        response: '',
        error: data.error || 'Agent request failed',
        timestamp,
      };
    }

    return {
      nodeId: toNodeId,
      agentName,
      success: true,
      response: data.answer || '',
      timestamp,
    };
  } catch (error: any) {
    console.error(`[Workflow] Agent ${agentName} exception:`, error);
    return {
      nodeId: toNodeId,
      agentName,
      success: false,
      response: '',
      error: error.message || 'Agent call failed',
      timestamp,
    };
  }
}

/**
 * GET handler for debugging - verifies the route is loading correctly
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Workflow trigger route is loaded. Use POST to trigger workflows.',
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const executionId = crypto.randomUUID();

  // Capture auth header to forward to internal API calls
  const authHeader = request.headers.get('authorization');

  // Initialize execution tracking at function scope for error handling
  const nodeStates: Record<string, NodeExecutionState> = {};
  const executionLog: ExecutionLogEntry[] = [];

  try {
    const body: TriggerWorkflowRequest = await request.json();
    const { canvasId, triggerNodeId, input } = body;

    console.log(`[POST /api/workflows/trigger] Starting execution ${executionId}`);
    console.log(`  Canvas: ${canvasId}`);
    console.log(`  Trigger: ${triggerNodeId}`);
    console.log(`  User: ${input.userId}`);

    // Validate input
    const validation = validateTriggerInput(input);
    if (!validation.isValid) {
      return NextResponse.json({
        success: false,
        error: validation.errors.join(', '),
      }, { status: 400 });
    }

    // Sanitize message
    const sanitizedMessage = sanitizeMessage(input.message);

    // Helper to add log entries
    const addLog = (level: 'info' | 'warn' | 'error', message: string, nodeId?: string, data?: any) => {
      executionLog.push({
        timestamp: new Date().toISOString(),
        level,
        node_id: nodeId,
        message,
        data,
      });
    };

    // Helper to update node state
    // SECURITY: Validate nodeId to prevent prototype pollution
    const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'];
    const updateNodeState = (nodeId: string, updates: Partial<NodeExecutionState>) => {
      // Prevent prototype pollution attacks
      if (FORBIDDEN_KEYS.includes(nodeId)) {
        console.warn(`[Workflow] Attempted to use forbidden key as nodeId: ${nodeId}`);
        return;
      }
      if (!Object.prototype.hasOwnProperty.call(nodeStates, nodeId)) {
        nodeStates[nodeId] = {
          node_id: nodeId,
          status: 'pending',
        };
      }
      Object.assign(nodeStates[nodeId], updates);
    };

    // Insert initial execution record
    addLog('info', `Workflow triggered with message: "${sanitizedMessage.slice(0, 100)}${sanitizedMessage.length > 100 ? '...' : ''}"`, undefined, {
      userId: input.userId,
      hasAttachments: (input.attachments?.length || 0) > 0,
    });

    const { error: insertError } = await getSupabase()
      .from('workflow_executions')
      .insert({
        id: executionId,
        canvas_id: canvasId,
        status: 'running',
        started_at: new Date().toISOString(),
        node_states: nodeStates,
        execution_log: executionLog,
      });

    if (insertError) {
      console.error('[POST /api/workflows/trigger] Failed to insert execution record:', insertError);
      // Continue anyway - execution tracking is non-critical
    }

    // Fetch the trigger node
    const { data: triggerNode, error: triggerError } = await getSupabase()
      .from('canvas_nodes')
      .select('*')
      .eq('id', triggerNodeId)
      .eq('canvas_id', canvasId)
      .eq('type', 'MASTER_TRIGGER')
      .single();

    if (triggerError || !triggerNode) {
      console.error('[POST /api/workflows/trigger] Trigger node not found:', triggerError);
      return NextResponse.json({
        success: false,
        error: 'Trigger node not found',
      }, { status: 404 });
    }

    // Check if trigger is exposed (use the dedicated column, not encrypted config)
    // The is_exposed column is synced from config on save for efficient querying
    if (!triggerNode.is_exposed) {
      console.log('[POST /api/workflows/trigger] Workflow not exposed. is_exposed column:', triggerNode.is_exposed);
      return NextResponse.json({
        success: false,
        error: 'This workflow is not exposed',
      }, { status: 403 });
    }

    // Get config for display name (may be encrypted, so handle gracefully)
    const triggerConfig = (triggerNode.config && typeof triggerNode.config === 'object')
      ? triggerNode.config as { display_name?: string; trigger_count?: number; }
      : { display_name: 'Master Trigger', trigger_count: 0 };

    // Track trigger node
    updateNodeState(triggerNodeId, {
      status: 'completed',
      started_at: new Date().toISOString(),
      ended_at: new Date().toISOString(),
      input: { message: sanitizedMessage, userId: input.userId },
      output: { forwarding: true },
    });
    addLog('info', `Trigger node activated: ${triggerConfig.display_name || 'Master Trigger'}`, triggerNodeId);

    // Fetch edges from this trigger node
    const { data: edges, error: edgesError } = await getSupabase()
      .from('canvas_edges')
      .select('*')
      .eq('from_node_id', triggerNodeId)
      .eq('canvas_id', canvasId);

    if (edgesError) {
      console.error('[POST /api/workflows/trigger] Error fetching edges:', edgesError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch workflow connections',
      }, { status: 500 });
    }

    if (!edges || edges.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Trigger node has no connected bots',
      }, { status: 400 });
    }

    // Get connected node IDs
    const connectedNodeIds = edges.map((e: any) => e.to_node_id);

    // Fetch ALL connected nodes (could be Genesis Bot, Smart Router, or other types)
    const { data: connectedNodes, error: nodesError } = await getSupabase()
      .from('canvas_nodes')
      .select('*')
      .in('id', connectedNodeIds);

    if (nodesError || !connectedNodes || connectedNodes.length === 0) {
      console.error('[POST /api/workflows/trigger] No nodes connected:', nodesError);
      return NextResponse.json({
        success: false,
        error: 'No nodes connected to trigger',
      }, { status: 400 });
    }

    // SECURITY: Get validated internal base URL to prevent SSRF
    // Uses only env vars, never request-derived values
    const internalBaseUrl = getInternalBaseUrl();

    // Build conversation history in Ask/Answer format for context
    const askAnswerHistory = (input.conversationHistory || []).reduce((acc, msg, idx, arr) => {
      // Pair user messages with the following assistant message
      if (msg.role === 'user' && arr[idx + 1]?.role === 'assistant') {
        acc.push({
          id: `hist-${idx}`,
          query: msg.content,
          answer: arr[idx + 1].content,
          timestamp: new Date().toISOString(),
        });
      }
      return acc;
    }, [] as Array<{ id: string; query: string; answer: string; timestamp: string }>);

    // Create a virtual "from" node config representing the trigger
    const triggerAsFromNode = {
      name: triggerConfig.display_name || 'Master Trigger',
      model_provider: 'system',
      model_name: 'trigger',
    };

    let response = '';

    // Check if the first connected node is a Smart Router
    const smartRouterNode = connectedNodes.find((n: any) => n.type === 'SMART_ROUTER');

    if (smartRouterNode) {
      // === SMART ROUTER WORKFLOW ===
      console.log(`[POST /api/workflows/trigger] Detected Smart Router workflow`);
      addLog('info', 'Detected Smart Router workflow', smartRouterNode.id);

      const routerConfig = smartRouterNode.config as SmartRouterNodeConfig;

      // Track Smart Router starting
      updateNodeState(smartRouterNode.id, {
        status: 'running',
        started_at: new Date().toISOString(),
        input: { query: sanitizedMessage },
      });

      // Fetch edges from Smart Router to find connected agents
      const { data: routerEdges, error: routerEdgesError } = await getSupabase()
        .from('canvas_edges')
        .select('*')
        .eq('from_node_id', smartRouterNode.id)
        .eq('canvas_id', canvasId);

      if (routerEdgesError || !routerEdges || routerEdges.length === 0) {
        console.error('[POST /api/workflows/trigger] Smart Router has no connected agents');
        return NextResponse.json({
          success: false,
          error: 'Smart Router has no connected agents',
        }, { status: 400 });
      }

      // Fetch agent nodes connected to Smart Router
      const agentNodeIds = routerEdges.map((e: any) => e.to_node_id);
      const { data: agentNodes, error: agentNodesError } = await getSupabase()
        .from('canvas_nodes')
        .select('*')
        .in('id', agentNodeIds)
        .eq('type', 'GENESIS_BOT');

      if (agentNodesError || !agentNodes || agentNodes.length === 0) {
        console.error('[POST /api/workflows/trigger] No agents connected to Smart Router');
        return NextResponse.json({
          success: false,
          error: 'No agents connected to Smart Router',
        }, { status: 400 });
      }

      // Build ConnectedAgentInfo for all agents
      const connectedAgents: ConnectedAgentInfo[] = agentNodes.map((node: any) =>
        buildAgentInfo(node.id, node.config as GenesisBotNodeConfig)
      );

      console.log(`[POST /api/workflows/trigger] Smart Router has ${connectedAgents.length} connected agents`);
      connectedAgents.forEach((agent) => {
        console.log(`  - ${agent.name}: [${agent.integrations.join(', ')}]`);
      });

      // Execute Smart Router to determine which agents to call
      const routingDecision = await executeSmartRouter(
        routerConfig,
        sanitizedMessage,
        connectedAgents,
        input.userId,
        internalBaseUrl
      );

      console.log(`[POST /api/workflows/trigger] Smart Router decision:`);
      console.log(`  Targets: ${routingDecision.targetNodeIds.join(', ')}`);
      console.log(`  Reasoning: ${routingDecision.reasoning}`);
      console.log(`  Confidence: ${routingDecision.confidence}`);

      // Track Smart Router completion
      updateNodeState(smartRouterNode.id, {
        status: 'completed',
        ended_at: new Date().toISOString(),
        output: {
          targetNodeIds: routingDecision.targetNodeIds,
          reasoning: routingDecision.reasoning,
          confidence: routingDecision.confidence,
        },
      });
      addLog('info', `Smart Router routed to ${routingDecision.targetNodeIds.length} agent(s)`, smartRouterNode.id, {
        targets: routingDecision.targetNodeIds,
        reasoning: routingDecision.reasoning,
      });

      if (routingDecision.targetNodeIds.length === 0) {
        // No routing target - use first agent as fallback
        console.log(`[POST /api/workflows/trigger] No routing targets, using first agent as fallback`);
        routingDecision.targetNodeIds = [agentNodes[0].id];
      }

      // Build edge map for quick lookup
      const edgeMap = new Map<string, CanvasEdge>();
      routerEdges.forEach((e: any) => edgeMap.set(e.to_node_id, e));

      // Call all target agents in parallel
      const targetAgents = agentNodes.filter((n: any) => routingDecision.targetNodeIds.includes(n.id));
      console.log(`[POST /api/workflows/trigger] Calling ${targetAgents.length} agents in parallel`);

      // Mark all target agents as running
      targetAgents.forEach((agentNode: any) => {
        const agentConfig = agentNode.config as GenesisBotNodeConfig;
        updateNodeState(agentNode.id, {
          status: 'running',
          started_at: new Date().toISOString(),
          input: { query: sanitizedMessage },
        });
        addLog('info', `Starting agent: ${agentConfig.name || 'AI Agent'}`, agentNode.id);
      });

      const agentPromises = targetAgents.map((agentNode: any) => {
        const agentConfig = agentNode.config as GenesisBotNodeConfig;
        const edge = edgeMap.get(agentNode.id);

        return callAgentAskAnswer({
          canvasId,
          fromNodeId: smartRouterNode.id,
          toNodeId: agentNode.id,
          edgeId: edge?.id || '',
          query: sanitizedMessage,
          userId: input.userId,
          fromNodeConfig: routerConfig,
          toNodeConfig: agentConfig,
          conversationHistory: askAnswerHistory,
          attachments: input.attachments,
          internalBaseUrl,
          authHeader,
        });
      });

      const agentResponses = await Promise.all(agentPromises);

      console.log(`[POST /api/workflows/trigger] All agents responded:`);
      agentResponses.forEach((resp) => {
        console.log(`  - ${resp.agentName}: ${resp.success ? 'success' : 'failed'} (${resp.response.length} chars)`);
        // Track agent completion
        updateNodeState(resp.nodeId, {
          status: resp.success ? 'completed' : 'failed',
          ended_at: new Date().toISOString(),
          output: resp.success ? { response: resp.response.slice(0, 500) } : undefined,
          error: resp.error,
        });
        addLog(resp.success ? 'info' : 'error', `Agent ${resp.agentName} ${resp.success ? 'completed' : 'failed'}`, resp.nodeId, {
          responseLength: resp.response.length,
          error: resp.error,
        });
      });

      // Check if there's a Response Compiler downstream
      // Find edges from agents to Response Compiler
      const { data: allCanvasEdges } = await getSupabase()
        .from('canvas_edges')
        .select('*')
        .eq('canvas_id', canvasId);

      const { data: allCanvasNodes } = await getSupabase()
        .from('canvas_nodes')
        .select('*')
        .eq('canvas_id', canvasId)
        .eq('type', 'RESPONSE_COMPILER');

      const responseCompilerNode = allCanvasNodes?.[0]; // Use first Response Compiler found

      if (responseCompilerNode) {
        console.log(`[POST /api/workflows/trigger] Found Response Compiler: ${responseCompilerNode.id}`);

        const compilerConfig = responseCompilerNode.config as ResponseCompilerNodeConfig;

        // Track Response Compiler starting
        updateNodeState(responseCompilerNode.id, {
          status: 'running',
          started_at: new Date().toISOString(),
          input: { agentResponses: agentResponses.map(r => ({ name: r.agentName, success: r.success })) },
        });
        addLog('info', 'Starting Response Compiler', responseCompilerNode.id);

        // Execute Response Compiler
        const compiledResponse = await executeResponseCompiler(
          compilerConfig,
          sanitizedMessage,
          agentResponses,
          input.userId,
          internalBaseUrl
        );

        response = compiledResponse;
        console.log(`[POST /api/workflows/trigger] Response compiled (${response.length} chars)`);

        // Track Response Compiler completion
        updateNodeState(responseCompilerNode.id, {
          status: 'completed',
          ended_at: new Date().toISOString(),
          output: { response: response.slice(0, 500) },
        });
        addLog('info', 'Response Compiler completed', responseCompilerNode.id, { responseLength: response.length });

        // Update Response Compiler statistics
        await getSupabase()
          .from('canvas_nodes')
          .update({
            config: {
              ...compilerConfig,
              compilation_count: (compilerConfig.compilation_count || 0) + 1,
              last_compiled_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', responseCompilerNode.id);
      } else {
        // No Response Compiler - concatenate agent responses
        console.log(`[POST /api/workflows/trigger] No Response Compiler, concatenating responses`);

        const successfulResponses = agentResponses.filter((r) => r.success);
        if (successfulResponses.length === 1) {
          response = successfulResponses[0].response;
        } else if (successfulResponses.length > 1) {
          response = successfulResponses
            .map((r: any) => `**${r.agentName}:**\n${r.response}`)
            .join('\n\n---\n\n');
        } else {
          // All failed
          const errors = agentResponses.map((r: any) => `${r.agentName}: ${r.error}`);
          response = `I encountered issues processing your request:\n\n${errors.map((e: any) => `- ${e}`).join('\n')}`;
        }
      }

      // Update Smart Router statistics
      await getSupabase()
        .from('canvas_nodes')
        .update({
          config: {
            ...routerConfig,
            routing_count: (routerConfig.routing_count || 0) + 1,
            last_routed_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', smartRouterNode.id);

    } else {
      // === LEGACY SINGLE BOT WORKFLOW ===
      // Use the first connected Genesis Bot (original behavior)
      const targetBot = connectedNodes.find((n: any) => n.type === 'GENESIS_BOT');

      if (!targetBot) {
        console.error('[POST /api/workflows/trigger] No Genesis Bot connected');
        return NextResponse.json({
          success: false,
          error: 'No Genesis Bot connected to trigger',
        }, { status: 400 });
      }

      const botConfig = targetBot.config as GenesisBotNodeConfig;

      // Track bot starting
      updateNodeState(targetBot.id, {
        status: 'running',
        started_at: new Date().toISOString(),
        input: { query: sanitizedMessage },
      });
      addLog('info', `Starting bot: ${botConfig.name || 'AI Agent'}`, targetBot.id);

      console.log(`[POST /api/workflows/trigger] Executing with bot: ${botConfig.name}`);
      console.log(`  Model: ${botConfig.model_provider}/${botConfig.model_name}`);
      console.log(`  System Prompt (first 100 chars): ${botConfig.system_prompt?.slice(0, 100) || 'UNDEFINED'}`);

      if (askAnswerHistory.length > 0) {
        console.log(`[POST /api/workflows/trigger] Including ${askAnswerHistory.length} conversation history entries`);
      }

      // Call Ask/Answer API for the first bot - this gives us Gmail tool support
      const askAnswerUrl = new URL('/api/canvas/ask-answer/query', internalBaseUrl);
      const askAnswerHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...getVercelBypassHeaders(), // Bypass Vercel Deployment Protection
      };
      // Add internal service auth for server-to-server calls
      const legacyServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (legacyServiceKey) {
        askAnswerHeaders[INTERNAL_SERVICE_AUTH_HEADER] = legacyServiceKey;
      }
      if (authHeader) {
        askAnswerHeaders['Authorization'] = authHeader;
      }
      const apiResponse = await fetch(askAnswerUrl.toString(), {
        method: 'POST',
        headers: askAnswerHeaders,
        body: JSON.stringify({
          canvasId,
          fromNodeId: triggerNodeId,
          toNodeId: targetBot.id,
          edgeId: edges[0].id,
          query: sanitizedMessage,
          queryId: crypto.randomUUID(),
          userId: input.userId,
          fromNodeConfig: triggerAsFromNode,
          toNodeConfig: botConfig,
          conversationHistory: askAnswerHistory,
          uploadedAttachments: input.attachments, // Pass user's uploaded files for email attachments
        }),
      });

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text();
        console.error('[POST /api/workflows/trigger] API error:', apiResponse.status, errorText);
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.error || 'API request failed');
        } catch {
          throw new Error(`API request failed: ${apiResponse.status} - ${errorText.slice(0, 200)}`);
        }
      }

      const apiData = await apiResponse.json();

      if (!apiData.success) {
        throw new Error(apiData.error || 'Ask/Answer query failed');
      }

      response = apiData.answer || '';

      console.log(`[POST /api/workflows/trigger] First bot response received (${response.length} chars)`);

      // Track first bot completion
      updateNodeState(targetBot.id, {
        status: 'completed',
        ended_at: new Date().toISOString(),
        output: { response: response.slice(0, 500) },
      });
      addLog('info', `Bot ${botConfig.name || 'AI Agent'} completed`, targetBot.id, { responseLength: response.length });

      // === CHAINING: Check if first bot has Ask/Answer connections to other bots ===
      let currentBotId = targetBot.id;
      let chainDepth = 0;
      const maxChainDepth = 5; // Prevent infinite loops

      while (chainDepth < maxChainDepth) {
        // Fetch edges FROM the current bot that have Ask/Answer enabled
        const { data: askAnswerEdges, error: aaEdgesError } = await getSupabase()
          .from('canvas_edges')
          .select('*')
          .eq('from_node_id', currentBotId)
          .eq('canvas_id', canvasId);

        if (aaEdgesError || !askAnswerEdges || askAnswerEdges.length === 0) {
          console.log(`[POST /api/workflows/trigger] No outgoing edges from bot ${currentBotId}, ending chain`);
          break;
        }

        // Find edges with Ask/Answer enabled
        const enabledEdges = askAnswerEdges.filter(
          (e: any) => e.metadata?.askAnswerEnabled === true
        );

        if (enabledEdges.length === 0) {
          console.log(`[POST /api/workflows/trigger] No Ask/Answer edges from bot ${currentBotId}, ending chain`);
          break;
        }

        // Use first Ask/Answer edge (for linear chains)
        const nextEdge = enabledEdges[0];
        const nextBotId = nextEdge.to_node_id;

        // Fetch the next bot
        const { data: nextBot, error: nextBotError } = await getSupabase()
          .from('canvas_nodes')
          .select('*')
          .eq('id', nextBotId)
          .eq('type', 'GENESIS_BOT')
          .single();

        if (nextBotError || !nextBot) {
          console.log(`[POST /api/workflows/trigger] Next bot ${nextBotId} not found, ending chain`);
          break;
        }

        const nextBotConfig = nextBot.config as GenesisBotNodeConfig;
        const currentBot = chainDepth === 0 ? targetBot : await getSupabase()
          .from('canvas_nodes')
          .select('*')
          .eq('id', currentBotId)
          .single()
          .then((r: any) => r.data);

        const currentBotConfig = currentBot?.config as GenesisBotNodeConfig;

        chainDepth++;
        console.log(`[POST /api/workflows/trigger] Chain step ${chainDepth}: ${currentBotConfig?.name} → ${nextBotConfig.name} via Ask/Answer`);

        // Track chain bot starting
        updateNodeState(nextBotId, {
          status: 'running',
          started_at: new Date().toISOString(),
          input: { query: response.slice(0, 200), chainDepth },
        });
        addLog('info', `Chain step ${chainDepth}: Starting ${nextBotConfig.name}`, nextBotId);

        // Skip chaining if the response from previous bot is empty
        if (!response || response.trim().length === 0) {
          console.log(`[POST /api/workflows/trigger] Skipping chain step ${chainDepth} - previous bot response is empty`);
          chainDepth--;
          break;
        }

        // Build conversation history from the input (passed from dashboard)
        // Convert to Ask/Answer format: array of { id, query, answer, timestamp }
        const chainHistory = (input.conversationHistory || []).reduce((acc, msg, idx, arr) => {
          // Pair user messages with the following assistant message
          if (msg.role === 'user' && arr[idx + 1]?.role === 'assistant') {
            acc.push({
              id: `hist-${idx}`,
              query: msg.content,
              answer: arr[idx + 1].content,
              timestamp: new Date().toISOString(),
            });
          }
          return acc;
        }, [] as Array<{ id: string; query: string; answer: string; timestamp: string }>);

        // Call Ask/Answer API to send response to next bot
        const chainAskAnswerUrl = new URL('/api/canvas/ask-answer/query', internalBaseUrl);
        const chainHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          ...getVercelBypassHeaders(), // Bypass Vercel Deployment Protection
        };
        // Add internal service auth for server-to-server calls
        const chainServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (chainServiceKey) {
          chainHeaders[INTERNAL_SERVICE_AUTH_HEADER] = chainServiceKey;
        }
        if (authHeader) {
          chainHeaders['Authorization'] = authHeader;
        }
        const askAnswerResponse = await fetch(chainAskAnswerUrl.toString(), {
          method: 'POST',
          headers: chainHeaders,
          body: JSON.stringify({
            canvasId,
            fromNodeId: currentBotId,
            toNodeId: nextBotId,
            edgeId: nextEdge.id,
            query: response, // Send previous bot's response as the query
            queryId: crypto.randomUUID(),
            userId: input.userId,
            fromNodeConfig: currentBotConfig,
            toNodeConfig: nextBotConfig,
            conversationHistory: chainHistory, // Pass conversation history for context
            uploadedAttachments: input.attachments, // Pass user's uploaded files for email attachments
          }),
        });

        if (!askAnswerResponse.ok) {
          const errorText = await askAnswerResponse.text();
          console.error(`[POST /api/workflows/trigger] Ask/Answer error at chain step ${chainDepth}:`, errorText);
          break;
        }

        const askAnswerData = await askAnswerResponse.json();

        if (!askAnswerData.success) {
          console.error(`[POST /api/workflows/trigger] Ask/Answer failed at chain step ${chainDepth}:`, askAnswerData.error);
          break;
        }

        // Update response with the chained bot's answer
        response = askAnswerData.answer || response;
        currentBotId = nextBotId;

        // Track chain bot completion
        updateNodeState(nextBotId, {
          status: 'completed',
          ended_at: new Date().toISOString(),
          output: { response: response.slice(0, 500) },
        });
        addLog('info', `Chain step ${chainDepth}: ${nextBotConfig.name} completed`, nextBotId, { responseLength: response.length });

        console.log(`[POST /api/workflows/trigger] Chain step ${chainDepth} completed (${response.length} chars)`);
      }

      if (chainDepth > 0) {
        console.log(`[POST /api/workflows/trigger] Workflow chain completed with ${chainDepth} Ask/Answer hops`);
      }
    } // End of else block (Legacy single bot workflow)

    const duration_ms = Date.now() - startTime;

    // Update trigger statistics
    await getSupabase()
      .from('canvas_nodes')
      .update({
        config: {
          ...triggerConfig,
          trigger_count: (triggerConfig.trigger_count || 0) + 1,
          last_triggered_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', triggerNodeId);

    console.log(`[POST /api/workflows/trigger] Completed in ${duration_ms}ms`);

    // Add final log entry
    addLog('info', `Workflow completed successfully in ${duration_ms}ms`);

    // Update execution record with completion
    const { error: updateError } = await getSupabase()
      .from('workflow_executions')
      .update({
        status: 'completed',
        ended_at: new Date().toISOString(),
        node_states: nodeStates,
        execution_log: executionLog,
        final_output: {
          response: response.slice(0, 2000), // Limit size
          duration_ms,
        },
      })
      .eq('id', executionId);

    if (updateError) {
      console.error('[POST /api/workflows/trigger] Failed to update execution record:', updateError);
    }

    // Build metadata based on workflow type
    const workflowType = smartRouterNode ? 'smart_router' : 'single_bot';
    const metadata: MasterTriggerOutput['metadata'] = {
      canvasId,
      triggerNodeId,
    };

    if (smartRouterNode) {
      const routerConfig = smartRouterNode.config as SmartRouterNodeConfig;
      metadata.botName = routerConfig.name || 'Smart Router';
      metadata.model = `${routerConfig.model_provider}/${routerConfig.model_name}`;
      metadata.workflowType = 'smart_router';
    } else {
      const targetBot = connectedNodes.find((n: any) => n.type === 'GENESIS_BOT');
      if (targetBot) {
        const botConfig = targetBot.config as GenesisBotNodeConfig;
        metadata.botName = botConfig.name;
        metadata.model = `${botConfig.model_provider}/${botConfig.model_name}`;
      }
    }

    const output: MasterTriggerOutput = {
      success: true,
      response,
      executionId,
      duration_ms,
      metadata,
    };

    return NextResponse.json({
      success: true,
      output,
    });
  } catch (error: any) {
    const duration_ms = Date.now() - startTime;
    console.error('[POST /api/workflows/trigger] Error:', error);

    // Update execution record with failure
    try {
      await getSupabase()
        .from('workflow_executions')
        .update({
          status: 'failed',
          ended_at: new Date().toISOString(),
          error: error.message || 'Workflow execution failed',
          execution_log: [
            ...(executionLog || []),
            {
              timestamp: new Date().toISOString(),
              level: 'error',
              message: `Workflow failed: ${error.message || 'Unknown error'}`,
            },
          ],
        })
        .eq('id', executionId);
    } catch (updateError) {
      console.error('[POST /api/workflows/trigger] Failed to update execution record on error:', updateError);
    }

    const output: MasterTriggerOutput = {
      success: false,
      response: '',
      executionId,
      duration_ms,
      error: error.message || 'Workflow execution failed',
    };

    return NextResponse.json({
      success: false,
      output,
      error: error.message || 'Workflow execution failed',
    }, { status: 500 });
  }
}
