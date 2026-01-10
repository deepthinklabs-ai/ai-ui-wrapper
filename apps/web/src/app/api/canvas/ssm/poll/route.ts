/**
 * POST /api/canvas/ssm/poll
 *
 * Polls configured data sources (Gmail, etc.) for SSM nodes
 * and runs events through the rules engine.
 *
 * When rules match, creates workflow executions and sends
 * data to connected nodes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getGmailClient } from '@/lib/googleClients';
import { matchEvent } from '@/app/canvas/features/ssm-agent/lib/ssmRulesEngine';
import { processAutoReply } from '@/app/canvas/features/ssm-agent/features/auto-reply/sendReply';
import type { SSMAgentNodeConfig, SSMAlert, SSMEvent } from '@/app/canvas/types/ssm';
import type { SSMAutoReplyConfig } from '@/app/canvas/features/ssm-agent/features/auto-reply/types';

// ============================================================================
// TYPES
// ============================================================================

interface PollRequest {
  canvasId: string;
  nodeId: string;
  userId: string;
  // Client passes decrypted config since server can't decrypt
  rules?: SSMAgentNodeConfig['rules'];
  gmail?: SSMAgentNodeConfig['gmail'];
  auto_reply?: SSMAutoReplyConfig;
}

interface PollResponse {
  success: boolean;
  eventsProcessed: number;
  alertsGenerated: number;
  alerts: SSMAlert[];
  error?: string;
}

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<PollResponse>> {
  try {
    const body: PollRequest = await request.json();
    const { canvasId, nodeId, userId, rules, gmail, auto_reply } = body;

    // Validate required fields
    if (!canvasId || !nodeId || !userId) {
      console.error('[SSM Poll] Missing fields:', { canvasId: !!canvasId, nodeId: !!nodeId, userId: !!userId });
      return NextResponse.json({
        success: false,
        eventsProcessed: 0,
        alertsGenerated: 0,
        alerts: [],
        error: `Missing required fields: ${!canvasId ? 'canvasId ' : ''}${!nodeId ? 'nodeId ' : ''}${!userId ? 'userId' : ''}`.trim(),
      }, { status: 400 });
    }


    const supabase = getSupabaseAdmin();

    // Verify user has Pro tier (SSM is a Pro feature)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', userId)
      .single();

    if (!profile || profile.tier !== 'pro') {
      return NextResponse.json({
        success: false,
        eventsProcessed: 0,
        alertsGenerated: 0,
        alerts: [],
        error: 'Polling Monitor requires Pro subscription',
      }, { status: 403 });
    }

    // Get node configuration
    const { data: node, error: nodeError } = await supabase
      .from('canvas_nodes')
      .select('*')
      .eq('id', nodeId)
      .eq('canvas_id', canvasId)
      .single();

    if (nodeError || !node) {
      console.error('[SSM Poll] Node not found:', { nodeId, canvasId, error: nodeError });
      return NextResponse.json({
        success: false,
        eventsProcessed: 0,
        alertsGenerated: 0,
        alerts: [],
        error: 'Node not found',
      }, { status: 404 });
    }

    // IMPORTANT: Config is encrypted! Use runtime_config for server-side checks
    // runtime_config stores unencrypted metadata for server-side access
    const runtimeConfig = node.runtime_config as {
      name?: string;
      is_enabled?: boolean;
      trained_at?: string;
      trained_by?: string;
      gmail_enabled?: boolean;
      gmail_connection_id?: string;
      events_processed?: number;
      alerts_triggered?: number;
      processed_event_ids?: string[];
    } | null;


    // Check if monitoring is enabled (from runtime_config since config is encrypted)
    if (!runtimeConfig?.is_enabled) {
      console.error('[SSM Poll] Monitoring not enabled for node:', nodeId, 'runtime_config:', runtimeConfig);
      return NextResponse.json({
        success: false,
        eventsProcessed: 0,
        alertsGenerated: 0,
        alerts: [],
        error: 'Monitoring is not enabled for this node',
      }, { status: 400 });
    }

    // Check if node has been trained
    if (!runtimeConfig?.trained_at) {
      console.error('[SSM Poll] Node not trained:', nodeId);
      return NextResponse.json({
        success: false,
        eventsProcessed: 0,
        alertsGenerated: 0,
        alerts: [],
        error: 'Node has not been trained yet',
      }, { status: 400 });
    }

    // Check if Gmail is connected (needed for polling)
    if (!runtimeConfig?.gmail_enabled || !runtimeConfig?.gmail_connection_id) {
      console.error('[SSM Poll] Gmail not connected:', nodeId);
      return NextResponse.json({
        success: false,
        eventsProcessed: 0,
        alertsGenerated: 0,
        alerts: [],
        error: 'Gmail is not connected for this node',
      }, { status: 400 });
    }

    // IMPORTANT: Config is encrypted in database - use values passed from client
    // The client decrypts the config and passes rules/gmail in the request

    // Validate that we have the decrypted config from client
    if (!rules) {
      console.error('[SSM Poll] No rules passed from client - config is encrypted');
      return NextResponse.json({
        success: false,
        eventsProcessed: 0,
        alertsGenerated: 0,
        alerts: [],
        error: 'No rules provided - please refresh the page and try again',
      }, { status: 400 });
    }

    // Determine data source and fetch events
    let events: SSMEvent[] = [];

    // Check for Gmail integration using the gmail config from request
    if (gmail?.enabled) {
      // Build a minimal config object for fetchGmailEvents
      const gmailConfig = {
        gmail,
        last_event_at: undefined, // Will fetch from last hour
      } as SSMAgentNodeConfig;
      events = await fetchGmailEvents(userId, gmailConfig, node.id);
    }

    // Filter out already-processed events to prevent duplicate counting
    const processedIds = new Set(runtimeConfig?.processed_event_ids || []);
    const newEvents = events.filter(e => !processedIds.has(e.id));

    // If no new events, return early
    if (newEvents.length === 0) {
      return NextResponse.json({
        success: true,
        eventsProcessed: 0,
        alertsGenerated: 0,
        alerts: [],
      });
    }

    // Get connected nodes for forwarding alerts
    const connectedNodes = await getConnectedNodes(supabase, canvasId, nodeId);

    // Process only NEW events through rules engine
    const alerts: SSMAlert[] = [];
    let alertsGenerated = 0;
    const newlyProcessedIds: string[] = [];

    for (const event of newEvents) {
      newlyProcessedIds.push(event.id);
      // Use matchEvent instead of testRules to include metadata (from, subject, etc.)
      const result = matchEvent(event, rules);

      if (result.matched) {
        // Determine highest severity
        const severities = result.matched_rules.map(() => 'warning'); // Default
        const highestSeverity = severities.includes('critical')
          ? 'critical'
          : severities.includes('warning')
            ? 'warning'
            : 'info';

        // Create alert
        const alert: SSMAlert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          severity: highestSeverity as SSMAlert['severity'],
          title: `Email from ${event.metadata?.from || 'Unknown'}: ${event.metadata?.subject || 'No subject'}`,
          message: event.content.substring(0, 500),
          event_id: event.id,
          matched_rules: result.matched_rules.map(r => r.rule_name),
          timestamp: new Date().toISOString(),
          acknowledged: false,
          source_node_id: nodeId,
          forwarded_to_ai: connectedNodes.length > 0,
        };

        alerts.push(alert);
        alertsGenerated++;

        // Create workflow execution record
        const executionId = await createWorkflowExecution(supabase, canvasId, nodeId, event, alert);

        // Forward to connected AI Agent nodes
        if (connectedNodes.length > 0) {
          await forwardToConnectedNodes(supabase, canvasId, executionId, nodeId, connectedNodes, event, alert);
        }

        // Process auto-reply if configured
        if (auto_reply?.enabled) {
          try {
            const replyResult = await processAutoReply(userId, event, alert, auto_reply);
            if (replyResult.result.success) {
              console.log(`[SSM Poll] Auto-reply sent to ${replyResult.result.recipient}`);
            } else if (replyResult.result.rateLimited) {
              console.log(`[SSM Poll] Auto-reply rate limited: ${replyResult.result.error}`);
            } else {
              console.warn(`[SSM Poll] Auto-reply failed: ${replyResult.result.error}`);
            }
          } catch (replyError) {
            console.error('[SSM Poll] Auto-reply error:', replyError);
          }
        }
      }
    }

    // Update stats in runtime_config (not encrypted config)
    // Stats are stored in runtime_config so server can track them without decryption
    // Also store processed event IDs to prevent duplicate counting
    const existingProcessedIds = runtimeConfig?.processed_event_ids || [];
    const allProcessedIds = [...existingProcessedIds, ...newlyProcessedIds];
    // Keep only last 500 IDs to prevent unbounded growth (covers ~8 hours of 60s polling)
    const trimmedProcessedIds = allProcessedIds.slice(-500);

    await supabase
      .from('canvas_nodes')
      .update({
        runtime_config: {
          ...runtimeConfig,
          events_processed: (runtimeConfig?.events_processed || 0) + newEvents.length,
          alerts_triggered: (runtimeConfig?.alerts_triggered || 0) + alertsGenerated,
          last_event_at: new Date().toISOString(),
          processed_event_ids: trimmedProcessedIds,
        },
      })
      .eq('id', nodeId);

    return NextResponse.json({
      success: true,
      eventsProcessed: newEvents.length,
      alertsGenerated,
      alerts,
    });

  } catch (error) {
    console.error('[SSM Poll] Error:', error);
    return NextResponse.json({
      success: false,
      eventsProcessed: 0,
      alertsGenerated: 0,
      alerts: [],
      error: 'Failed to poll data source',
    }, { status: 500 });
  }
}

// ============================================================================
// GMAIL FETCHING
// ============================================================================

async function fetchGmailEvents(
  userId: string,
  config: SSMAgentNodeConfig,
  nodeId: string
): Promise<SSMEvent[]> {
  const events: SSMEvent[] = [];

  try {
    const gmail = await getGmailClient(userId);

    // Build Gmail query based on config
    let query = 'is:unread';
    if (config.gmail?.filter_from) {
      query += ` from:${config.gmail.filter_from}`;
    }
    if (config.gmail?.filter_subject) {
      query += ` subject:${config.gmail.filter_subject}`;
    }
    // Get emails from last poll or last hour
    const sinceDate = config.last_event_at
      ? new Date(config.last_event_at)
      : new Date(Date.now() - 60 * 60 * 1000);
    query += ` after:${Math.floor(sinceDate.getTime() / 1000)}`;

    // Search for emails
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50,
    });

    const messages = listResponse.data.messages || [];

    // Fetch full content for each message
    for (const msg of messages) {
      if (!msg.id) continue;

      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      });

      // Extract headers
      const headers = fullMessage.data.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      const from = getHeader('From');
      const subject = getHeader('Subject');
      const date = getHeader('Date');

      // Extract body
      let body = '';
      const payload = fullMessage.data.payload;
      if (payload?.body?.data) {
        body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      } else if (payload?.parts) {
        // Multi-part email
        for (const part of payload.parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            break;
          }
        }
      }

      // Create event
      const event: SSMEvent = {
        id: msg.id,
        timestamp: date || new Date().toISOString(),
        source: 'gmail',
        type: 'email',
        content: `From: ${from}\nSubject: ${subject}\n\n${body}`,
        metadata: {
          from,
          subject,
          date,
          messageId: msg.id,
          threadId: fullMessage.data.threadId,
        },
      };

      events.push(event);
    }
  } catch (error: any) {
    console.error('[SSM Poll] Gmail fetch error:', error?.message || error);
  }

  return events;
}

// ============================================================================
// CONNECTED NODES
// ============================================================================

interface ConnectedNode {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

async function getConnectedNodes(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  canvasId: string,
  nodeId: string
): Promise<ConnectedNode[]> {
  try {
    // Get edges where this node is the source
    const { data: edges, error: edgesError } = await supabase
      .from('canvas_edges')
      .select('to_node_id')
      .eq('canvas_id', canvasId)
      .eq('from_node_id', nodeId);

    if (edgesError || !edges || edges.length === 0) {
      return [];
    }

    // Get the target nodes
    const targetNodeIds = edges.map(e => e.to_node_id);
    const { data: nodes, error: nodesError } = await supabase
      .from('canvas_nodes')
      .select('id, type, config')
      .in('id', targetNodeIds);

    if (nodesError || !nodes) {
      return [];
    }

    return nodes.map(n => ({
      id: n.id,
      type: n.type,
      config: n.config as Record<string, unknown>,
    }));
  } catch (error) {
    console.error('[SSM Poll] Failed to get connected nodes:', error);
    return [];
  }
}

async function forwardToConnectedNodes(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  canvasId: string,
  executionId: string,
  sourceNodeId: string,
  connectedNodes: ConnectedNode[],
  event: SSMEvent,
  alert: SSMAlert
): Promise<void> {
  const now = new Date().toISOString();

  for (const targetNode of connectedNodes) {
    try {
      // Only process AI Agent (GENESIS_BOT) nodes for now
      if (targetNode.type !== 'GENESIS_BOT') {
        continue;
      }

      // Update execution with target node state
      await supabase
        .from('workflow_executions')
        .update({
          node_states: {
            [sourceNodeId]: {
              node_id: sourceNodeId,
              status: 'completed',
              output: alert,
            },
            [targetNode.id]: {
              node_id: targetNode.id,
              status: 'pending',
              started_at: now,
              input: {
                from_ssm: true,
                alert,
                event,
                request: `Please summarize this email:\n\nFrom: ${event.metadata?.from}\nSubject: ${event.metadata?.subject}\n\n${event.content}`,
              },
            },
          },
          execution_log: [
            {
              timestamp: now,
              level: 'info',
              node_id: targetNode.id,
              message: `Forwarded alert to AI Agent: ${targetNode.config?.name || targetNode.id}`,
              data: { alert_id: alert.id },
            },
          ],
        })
        .eq('id', executionId);
    } catch (error) {
      console.error(`[SSM Poll] Failed to forward to node ${targetNode.id}:`, error);
    }
  }
}

// ============================================================================
// WORKFLOW EXECUTION
// ============================================================================

async function createWorkflowExecution(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  canvasId: string,
  nodeId: string,
  event: SSMEvent,
  alert: SSMAlert
): Promise<string> {
  try {
    const now = new Date().toISOString();
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // Create execution record
    await supabase.from('workflow_executions').insert({
      id: executionId,
      canvas_id: canvasId,
      status: 'running',
      started_at: now,
      node_states: {
        [nodeId]: {
          node_id: nodeId,
          status: 'completed',
          started_at: now,
          ended_at: now,
          input: event,
          output: alert,
        },
      },
      final_output: {
        trigger: 'ssm_monitor',
        event,
        alert,
      },
      execution_log: [
        {
          timestamp: now,
          level: 'info',
          node_id: nodeId,
          message: `SSM Alert: ${alert.title}`,
          data: {
            severity: alert.severity,
            matched_rules: alert.matched_rules,
          },
        },
      ],
    });

    return executionId;
  } catch (error) {
    console.error('[SSM Poll] Failed to create execution:', error);
    return '';
  }
}
