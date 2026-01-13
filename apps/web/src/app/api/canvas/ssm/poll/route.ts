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
import { getGmailClient, getCalendarClient, getSheetsClient, getDriveClient } from '@/lib/googleClients';
import { matchEvent } from '@/app/canvas/features/ssm-agent/lib/ssmRulesEngine';
import { processAutoReply } from '@/app/canvas/features/ssm-agent/features/auto-reply/sendReply';
import type { SSMAgentNodeConfig, SSMAlert, SSMEvent, SSMSheetsActionConfig, SSMSheetsField } from '@/app/canvas/types/ssm';
import type { SSMAutoReplyConfig } from '@/app/canvas/features/ssm-agent/features/auto-reply/types';
import type { CalendarOAuthConfig } from '@/app/canvas/features/calendar-oauth/types';

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
  calendar?: CalendarOAuthConfig;
  auto_reply?: SSMAutoReplyConfig;
  sheets_action?: SSMSheetsActionConfig;
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
    const { canvasId, nodeId, userId, rules, gmail, calendar, auto_reply, sheets_action } = body;

    // Debug logging for actions
    console.log('[SSM Poll] auto_reply config received:', JSON.stringify(auto_reply, null, 2));
    console.log('[SSM Poll] sheets_action config received:', JSON.stringify(sheets_action, null, 2));

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
      calendar_enabled?: boolean;
      calendar_connection_id?: string;
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

    // Check if at least one data source is connected (Gmail or Calendar)
    const hasGmail = runtimeConfig?.gmail_enabled && runtimeConfig?.gmail_connection_id;
    const hasCalendar = runtimeConfig?.calendar_enabled && runtimeConfig?.calendar_connection_id;

    if (!hasGmail && !hasCalendar) {
      console.error('[SSM Poll] No data source connected:', nodeId);
      return NextResponse.json({
        success: false,
        eventsProcessed: 0,
        alertsGenerated: 0,
        alerts: [],
        error: 'No data source (Gmail or Calendar) is connected for this node',
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
      const gmailEvents = await fetchGmailEvents(userId, gmailConfig, node.id);
      events.push(...gmailEvents);
    }

    // Check for Calendar integration using the calendar config from request
    if (calendar?.enabled) {
      const calendarEvents = await fetchCalendarEvents(userId, calendar);
      events.push(...calendarEvents);
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

      // Special case: If notificationRecipient is set and this is a calendar event,
      // treat it as a match even if no rules matched. This handles "notify me of all calendar events" scenarios.
      const isCalendarNotification = event.source === 'calendar' && auto_reply?.notificationRecipient;
      if (isCalendarNotification && !result.matched) {
        console.log(`[SSM Poll] Calendar event with notificationRecipient - forcing match for notification`);
      }

      if (result.matched || isCalendarNotification) {
        // Determine highest severity
        // For calendar notifications without rule matches, use 'info'
        let highestSeverity: 'info' | 'warning' | 'critical' = 'info';
        if (result.matched && result.matched_rules.length > 0) {
          const severities = result.matched_rules.map(() => 'warning'); // Default
          highestSeverity = severities.includes('critical')
            ? 'critical'
            : severities.includes('warning')
              ? 'warning'
              : 'info';
        }

        // Generate appropriate title based on event source
        let alertTitle: string;
        if (event.source === 'calendar') {
          alertTitle = `Calendar Event: ${event.metadata?.summary || 'No title'}`;
        } else {
          alertTitle = `Email from ${event.metadata?.from || 'Unknown'}: ${event.metadata?.subject || 'No subject'}`;
        }

        // Create alert
        const alert: SSMAlert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          severity: highestSeverity,
          title: alertTitle,
          message: event.content.substring(0, 500),
          event_id: event.id,
          matched_rules: result.matched_rules.length > 0
            ? result.matched_rules.map(r => r.rule_name)
            : ['Calendar Event Notification'],
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
        console.log('[SSM Poll] Checking auto-reply:', {
          enabled: auto_reply?.enabled,
          hasNotificationRecipient: !!auto_reply?.notificationRecipient,
          notificationRecipient: auto_reply?.notificationRecipient,
          eventSource: event.source
        });
        if (auto_reply?.enabled) {
          try {
            console.log('[SSM Poll] Calling processAutoReply with config:', JSON.stringify(auto_reply, null, 2));
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

        // Process Sheets logging if configured
        console.log('[SSM Poll] Checking sheets_action:', {
          enabled: sheets_action?.enabled,
          spreadsheetName: sheets_action?.spreadsheetName,
          eventSource: event.source
        });
        if (sheets_action?.enabled) {
          try {
            console.log('[SSM Poll] Logging to Sheets:', sheets_action.spreadsheetName);
            const sheetsResult = await logEventToSheets(userId, event, alert, sheets_action, supabase, nodeId);
            if (sheetsResult.success) {
              console.log(`[SSM Poll] Logged to Sheets: ${sheetsResult.spreadsheetId}`);
            } else {
              console.warn(`[SSM Poll] Sheets logging failed: ${sheetsResult.error}`);
            }
          } catch (sheetsError) {
            console.error('[SSM Poll] Sheets logging error:', sheetsError);
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
// CALENDAR FETCHING
// ============================================================================

async function fetchCalendarEvents(
  userId: string,
  config: CalendarOAuthConfig
): Promise<SSMEvent[]> {
  const events: SSMEvent[] = [];

  try {
    const calendar = await getCalendarClient(userId);

    // Get events from the last hour (to catch recently created events)
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // List events that were created or updated recently
    // We use updatedMin to catch new/modified events
    const listResponse = await calendar.events.list({
      calendarId: config.defaultCalendarId || 'primary',
      updatedMin: oneHourAgo.toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: 'updated',
    });

    const calendarEvents = listResponse.data.items || [];

    for (const calEvent of calendarEvents) {
      if (!calEvent.id) continue;

      // Get event start time
      const startTime = calEvent.start?.dateTime || calEvent.start?.date || '';
      const endTime = calEvent.end?.dateTime || calEvent.end?.date || '';

      // Build attendee list
      const attendees = calEvent.attendees
        ?.map(a => a.email || a.displayName)
        .filter(Boolean)
        .join(', ') || 'None';

      // Create event content for rules matching
      const content = `
Calendar Event: ${calEvent.summary || 'No title'}
Start: ${startTime}
End: ${endTime}
Location: ${calEvent.location || 'Not specified'}
Description: ${calEvent.description || 'No description'}
Attendees: ${attendees}
Organizer: ${calEvent.organizer?.email || 'Unknown'}
Status: ${calEvent.status || 'Unknown'}
      `.trim();

      const event: SSMEvent = {
        id: `cal_${calEvent.id}`,
        timestamp: calEvent.updated || calEvent.created || now.toISOString(),
        source: 'calendar',
        type: 'calendar_event',
        content,
        metadata: {
          eventId: calEvent.id,
          summary: calEvent.summary,
          start: startTime,
          end: endTime,
          location: calEvent.location,
          description: calEvent.description,
          attendees: calEvent.attendees?.map(a => a.email).filter(Boolean),
          organizer: calEvent.organizer?.email,
          status: calEvent.status,
          htmlLink: calEvent.htmlLink,
          created: calEvent.created,
          updated: calEvent.updated,
        },
      };

      events.push(event);
    }

    console.log(`[SSM Poll] Fetched ${events.length} calendar events`);
  } catch (error: any) {
    console.error('[SSM Poll] Calendar fetch error:', error?.message || error);
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

// ============================================================================
// SHEETS LOGGING
// ============================================================================

interface SheetsLogResult {
  success: boolean;
  spreadsheetId?: string;
  error?: string;
}

/**
 * Log an SSM event to a Google Sheets spreadsheet
 * Creates the spreadsheet if it doesn't exist
 */
async function logEventToSheets(
  userId: string,
  event: SSMEvent,
  alert: SSMAlert,
  config: SSMSheetsActionConfig,
  supabase: ReturnType<typeof getSupabaseAdmin>,
  nodeId: string
): Promise<SheetsLogResult> {
  try {
    // Get Sheets and Drive clients
    const sheets = await getSheetsClient(userId);
    const drive = await getDriveClient(userId);

    let spreadsheetId = config.spreadsheetId || config.cachedSpreadsheetId;

    // If no spreadsheet ID, try to find or create the spreadsheet
    if (!spreadsheetId) {
      // Search for existing spreadsheet by name
      const searchResponse = await drive.files.list({
        q: `name='${config.spreadsheetName}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
        spaces: 'drive',
        fields: 'files(id, name)',
      });

      const existingFiles = searchResponse.data.files || [];

      if (existingFiles.length > 0 && existingFiles[0].id) {
        spreadsheetId = existingFiles[0].id;
        console.log(`[SSM Sheets] Found existing spreadsheet: ${spreadsheetId}`);
      } else if (config.createIfMissing) {
        // Create new spreadsheet
        const createResponse = await sheets.spreadsheets.create({
          requestBody: {
            properties: {
              title: config.spreadsheetName,
            },
            sheets: [
              {
                properties: {
                  title: config.sheetName || 'Events',
                },
              },
            ],
          },
        });

        spreadsheetId = createResponse.data.spreadsheetId ?? undefined;
        console.log(`[SSM Sheets] Created new spreadsheet: ${spreadsheetId}`);

        // Add headers if configured
        if (spreadsheetId && config.includeHeaders && config.columns.length > 0) {
          const headers = config.columns.map(col => col.header);
          await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${config.sheetName || 'Events'}!A1`,
            valueInputOption: 'RAW',
            requestBody: {
              values: [headers],
            },
          });
          console.log(`[SSM Sheets] Added headers: ${headers.join(', ')}`);
        }

        // Cache the spreadsheet ID in the node's runtime_config
        if (spreadsheetId) {
          const { data: node } = await supabase
            .from('canvas_nodes')
            .select('runtime_config')
            .eq('id', nodeId)
            .single();

          if (node) {
            await supabase
              .from('canvas_nodes')
              .update({
                runtime_config: {
                  ...node.runtime_config,
                  sheets_spreadsheet_id: spreadsheetId,
                },
              })
              .eq('id', nodeId);
          }
        }
      } else {
        return {
          success: false,
          error: `Spreadsheet "${config.spreadsheetName}" not found and createIfMissing is false`,
        };
      }
    }

    if (!spreadsheetId) {
      return { success: false, error: 'Failed to get or create spreadsheet' };
    }

    // Extract field values from the event
    const rowData = config.columns.map(col => extractFieldValue(col.field, event, alert));

    // Append row to the spreadsheet
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${config.sheetName || 'Events'}!A:Z`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [rowData],
      },
    });

    console.log(`[SSM Sheets] Logged event to spreadsheet ${spreadsheetId}: ${rowData.join(', ')}`);

    return { success: true, spreadsheetId };
  } catch (error: any) {
    console.error('[SSM Sheets] Error logging to sheets:', error?.message || error);
    return { success: false, error: error?.message || 'Failed to log to sheets' };
  }
}

/**
 * Extract a field value from an SSM event for Sheets logging
 */
function extractFieldValue(field: SSMSheetsField, event: SSMEvent, alert: SSMAlert): string {
  switch (field) {
    case 'from':
      return String(event.metadata?.from || '');
    case 'subject':
      return String(event.metadata?.subject || '');
    case 'timestamp':
      return event.timestamp || new Date().toISOString();
    case 'body':
      // Get full body - extract from content after the header info
      const content = event.content || '';
      // For emails, body starts after the double newline following headers
      const bodyMatch = content.split('\n\n');
      return bodyMatch.length > 1 ? bodyMatch.slice(1).join('\n\n') : content;
    case 'body_preview':
      const preview = event.content || '';
      return preview.substring(0, 500);
    case 'matched_rules':
      return alert.matched_rules.join(', ');
    case 'severity':
      return alert.severity;
    case 'source':
      return event.source || '';
    case 'event_id':
      return event.id;
    default:
      return '';
  }
}

/**
 * Get default Sheets action config
 */
export function getDefaultSheetsActionConfig(): SSMSheetsActionConfig {
  return {
    enabled: false,
    spreadsheetName: 'SSM Event Log',
    sheetName: 'Events',
    columns: [
      { header: 'Timestamp', field: 'timestamp' },
      { header: 'From', field: 'from' },
      { header: 'Subject', field: 'subject' },
      { header: 'Body', field: 'body' },
      { header: 'Matched Rules', field: 'matched_rules' },
      { header: 'Severity', field: 'severity' },
    ],
    createIfMissing: true,
    includeHeaders: true,
  };
}
