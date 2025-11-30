/**
 * POST /api/workflows/trigger
 *
 * Triggers a workflow by executing from a Master Trigger node.
 * Routes the message to connected Genesis Bot and returns the response.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type {
  TriggerWorkflowRequest,
  MasterTriggerOutput,
} from '@/app/canvas/features/master-trigger/types';
import type { GenesisBotNodeConfig, CanvasEdge, CanvasNode } from '@/app/canvas/types';
import { validateTriggerInput, sanitizeMessage } from '@/app/canvas/features/master-trigger/lib/validation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const executionId = crypto.randomUUID();

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

    // Fetch the trigger node
    const { data: triggerNode, error: triggerError } = await supabase
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

    // Check if trigger is exposed
    const triggerConfig = triggerNode.config as {
      is_exposed?: boolean;
      display_name?: string;
      trigger_count?: number;
    };

    if (!triggerConfig.is_exposed) {
      return NextResponse.json({
        success: false,
        error: 'This workflow is not exposed',
      }, { status: 403 });
    }

    // Fetch edges from this trigger node
    const { data: edges, error: edgesError } = await supabase
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
    const connectedNodeIds = edges.map((e) => e.to_node_id);

    // Fetch connected Genesis Bot nodes
    const { data: connectedNodes, error: nodesError } = await supabase
      .from('canvas_nodes')
      .select('*')
      .in('id', connectedNodeIds)
      .eq('type', 'GENESIS_BOT');

    if (nodesError || !connectedNodes || connectedNodes.length === 0) {
      console.error('[POST /api/workflows/trigger] No Genesis Bot connected:', nodesError);
      return NextResponse.json({
        success: false,
        error: 'No Genesis Bot connected to trigger',
      }, { status: 400 });
    }

    // Use the first connected Genesis Bot (for now, single bot execution)
    const targetBot = connectedNodes[0];
    const botConfig = targetBot.config as GenesisBotNodeConfig;

    console.log(`[POST /api/workflows/trigger] Executing with bot: ${botConfig.name}`);
    console.log(`  Model: ${botConfig.model_provider}/${botConfig.model_name}`);

    // Build messages array
    const messages: Array<{ role: string; content: any }> = [];

    // Add attachments as content if present
    if (input.attachments && input.attachments.length > 0) {
      const contentParts: any[] = [{ type: 'text', text: sanitizedMessage }];

      for (const attachment of input.attachments) {
        if (attachment.isImage) {
          contentParts.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: attachment.type,
              data: attachment.content,
            },
          });
        }
        // For non-image files, append as text context
        else {
          contentParts.push({
            type: 'text',
            text: `\n\n[Attached file: ${attachment.name}]\n${attachment.content}`,
          });
        }
      }

      messages.push({ role: 'user', content: contentParts });
    } else {
      messages.push({ role: 'user', content: sanitizedMessage });
    }

    // Determine API endpoint based on provider
    const provider = botConfig.model_provider;
    const apiEndpoint =
      provider === 'openai' ? '/api/pro/openai' :
      provider === 'claude' ? '/api/pro/claude' :
      provider === 'grok' ? '/api/pro/grok' :
      null;

    if (!apiEndpoint) {
      return NextResponse.json({
        success: false,
        error: `Unsupported provider: ${provider}`,
      }, { status: 400 });
    }

    // Use the same origin as the incoming request (handles dynamic ports)
    const internalBaseUrl = new URL(request.url).origin;
    const apiUrl = new URL(apiEndpoint, internalBaseUrl);
    console.log(`[POST /api/workflows/trigger] Calling API: ${apiUrl.toString()}`);

    // Call the AI API
    const apiResponse = await fetch(apiUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: input.userId,
        messages,
        model: botConfig.model_name,
        systemPrompt: botConfig.system_prompt,
        temperature: botConfig.temperature,
        maxTokens: botConfig.max_tokens,
        enableWebSearch: botConfig.web_search_enabled !== false,
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
    let response = apiData.content || apiData.message || '';

    console.log(`[POST /api/workflows/trigger] First bot response received (${response.length} chars)`);

    // === CHAINING: Check if first bot has Ask/Answer connections to other bots ===
    let currentBotId = targetBot.id;
    let chainDepth = 0;
    const maxChainDepth = 5; // Prevent infinite loops

    while (chainDepth < maxChainDepth) {
      // Fetch edges FROM the current bot that have Ask/Answer enabled
      const { data: askAnswerEdges, error: aaEdgesError } = await supabase
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
        (e) => e.metadata?.askAnswerEnabled === true
      );

      if (enabledEdges.length === 0) {
        console.log(`[POST /api/workflows/trigger] No Ask/Answer edges from bot ${currentBotId}, ending chain`);
        break;
      }

      // Use first Ask/Answer edge (for linear chains)
      const nextEdge = enabledEdges[0];
      const nextBotId = nextEdge.to_node_id;

      // Fetch the next bot
      const { data: nextBot, error: nextBotError } = await supabase
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
      const currentBot = chainDepth === 0 ? targetBot : await supabase
        .from('canvas_nodes')
        .select('*')
        .eq('id', currentBotId)
        .single()
        .then(r => r.data);

      const currentBotConfig = currentBot?.config as GenesisBotNodeConfig;

      chainDepth++;
      console.log(`[POST /api/workflows/trigger] Chain step ${chainDepth}: ${currentBotConfig?.name} → ${nextBotConfig.name} via Ask/Answer`);

      // Call Ask/Answer API to send response to next bot
      const askAnswerUrl = new URL('/api/canvas/ask-answer/query', internalBaseUrl);
      const askAnswerResponse = await fetch(askAnswerUrl.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          conversationHistory: [], // Fresh conversation for workflow execution
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

      console.log(`[POST /api/workflows/trigger] Chain step ${chainDepth} completed (${response.length} chars)`);
    }

    if (chainDepth > 0) {
      console.log(`[POST /api/workflows/trigger] Workflow chain completed with ${chainDepth} Ask/Answer hops`);
    }

    const duration_ms = Date.now() - startTime;

    // Update trigger statistics
    await supabase
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

    const output: MasterTriggerOutput = {
      success: true,
      response,
      executionId,
      duration_ms,
      metadata: {
        botName: botConfig.name,
        model: `${botConfig.model_provider}/${botConfig.model_name}`,
        canvasId,
        triggerNodeId,
      },
    };

    return NextResponse.json({
      success: true,
      output,
    });
  } catch (error: any) {
    const duration_ms = Date.now() - startTime;
    console.error('[POST /api/workflows/trigger] Error:', error);

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
