/**
 * POST /api/canvas/smart-router
 *
 * Executes Smart Router logic to determine which AI Agents should handle a query.
 * Returns routing decision with target node IDs.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type {
  SmartRouterNodeConfig,
  ConnectedAgentInfo,
  GenesisBotNodeConfig,
  IntegrationType,
} from '@/app/canvas/types';
import { executeSmartRouter } from '@/app/canvas/features/smart-router';
import { getInternalBaseUrl } from '@/lib/internalApiUrl';
import { withDebug } from '@/lib/debug';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface SmartRouterRequest {
  canvasId: string;
  routerNodeId: string;
  query: string;
  userId: string;
}

/**
 * Build ConnectedAgentInfo from a Genesis Bot node
 */
function buildAgentInfoFromNode(node: {
  id: string;
  config: GenesisBotNodeConfig;
}): ConnectedAgentInfo {
  const config = node.config;
  const integrations: IntegrationType[] = [];
  const capabilities: string[] = [];

  // Detect enabled integrations
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

  // If no integrations, mark as general AI
  if (integrations.length === 0) {
    capabilities.push('General AI assistance');
  }

  return {
    nodeId: node.id,
    name: config.name || 'AI Agent',
    integrations,
    capabilities,
  };
}

export const POST = withDebug(async (request, sessionId) => {
  const startTime = Date.now();

  try {
    const body: SmartRouterRequest = await request.json();
    const { canvasId, routerNodeId, query, userId } = body;

    console.log(`[POST /api/canvas/smart-router] Starting routing decision`);
    console.log(`  Canvas: ${canvasId}`);
    console.log(`  Router: ${routerNodeId}`);
    console.log(`  Query (first 100 chars): ${query.substring(0, 100)}`);

    // Validate input
    if (!canvasId || !routerNodeId || !query || !userId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: canvasId, routerNodeId, query, userId',
      }, { status: 400 });
    }

    // Fetch the Smart Router node
    const { data: routerNode, error: routerError } = await supabase
      .from('canvas_nodes')
      .select('*')
      .eq('id', routerNodeId)
      .eq('canvas_id', canvasId)
      .eq('type', 'SMART_ROUTER')
      .single();

    if (routerError || !routerNode) {
      console.error('[POST /api/canvas/smart-router] Router node not found:', routerError);
      return NextResponse.json({
        success: false,
        error: 'Smart Router node not found',
      }, { status: 404 });
    }

    const routerConfig = routerNode.config as SmartRouterNodeConfig;

    // Fetch edges from this Smart Router node
    const { data: edges, error: edgesError } = await supabase
      .from('canvas_edges')
      .select('*')
      .eq('from_node_id', routerNodeId)
      .eq('canvas_id', canvasId);

    if (edgesError) {
      console.error('[POST /api/canvas/smart-router] Error fetching edges:', edgesError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch router connections',
      }, { status: 500 });
    }

    if (!edges || edges.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Smart Router has no connected agents',
        decision: {
          targetNodeIds: [],
          reasoning: 'No agents connected to Smart Router',
          confidence: 0,
        },
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

    if (nodesError) {
      console.error('[POST /api/canvas/smart-router] Error fetching agents:', nodesError);
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch connected agents',
      }, { status: 500 });
    }

    // Build ConnectedAgentInfo array
    const connectedAgents: ConnectedAgentInfo[] = (connectedNodes || []).map((node) =>
      buildAgentInfoFromNode({
        id: node.id,
        config: node.config as GenesisBotNodeConfig,
      })
    );

    console.log(`[POST /api/canvas/smart-router] Found ${connectedAgents.length} connected agents`);
    connectedAgents.forEach((agent) => {
      console.log(`  - ${agent.name}: [${agent.integrations.join(', ')}]`);
    });

    // SECURITY: Get validated internal base URL to prevent SSRF
    // Uses only env vars, never request-derived values
    const internalBaseUrl = getInternalBaseUrl();

    // Execute Smart Router logic
    const decision = await executeSmartRouter(
      routerConfig,
      query,
      connectedAgents,
      userId,
      internalBaseUrl
    );

    const duration_ms = Date.now() - startTime;

    console.log(`[POST /api/canvas/smart-router] Routing decision completed in ${duration_ms}ms`);
    console.log(`  Targets: ${decision.targetNodeIds.join(', ')}`);
    console.log(`  Reasoning: ${decision.reasoning}`);
    console.log(`  Confidence: ${decision.confidence}`);

    // Update router statistics
    await supabase
      .from('canvas_nodes')
      .update({
        config: {
          ...routerConfig,
          routing_count: (routerConfig.routing_count || 0) + 1,
          last_routed_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', routerNodeId);

    return NextResponse.json({
      success: true,
      decision,
      connectedAgents,
      duration_ms,
    });
  } catch (error: any) {
    console.error('[POST /api/canvas/smart-router] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Smart Router execution failed',
    }, { status: 500 });
  }
});
