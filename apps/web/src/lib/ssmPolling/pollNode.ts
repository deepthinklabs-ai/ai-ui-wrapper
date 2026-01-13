/**
 * SSM Node Polling Orchestrator
 *
 * Main entry point for polling an SSM node.
 * Used by both cron job and manual poll operations.
 *
 * Security:
 * - No plaintext logging of config data
 * - Only log node IDs, counts, and timing
 * - Audit fields updated on every operation
 */

import { createClient } from '@supabase/supabase-js';
import { fetchAllEvents } from './fetchEvents';
import { matchEventsToRules } from './matchRules';
import { executeAutoReplies } from './executeAutoReply';
import type { PollingConfig, PollOptions, PollResult, NodeRuntimeState } from './types';

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
// MAIN POLLING FUNCTION
// ============================================================================

/**
 * Poll an SSM node for events and process matches
 *
 * @param config - Polling configuration (decrypted)
 * @param options - Poll options (source, verbose)
 * @returns Poll result with counts and alerts
 */
export async function pollSSMNode(
  config: PollingConfig,
  options: PollOptions
): Promise<PollResult> {
  const startTime = Date.now();
  const { node_id, canvas_id, user_id } = config;

  // Initialize result
  const result: PollResult = {
    success: false,
    events_fetched: 0,
    alerts_generated: 0,
    auto_replies_sent: 0,
    alerts: [],
    duration_ms: 0,
    source: options.source,
    processed_event_ids: [],
  };

  try {
    const supabase = getSupabaseAdmin();

    // Get node runtime state (unencrypted metadata)
    const { data: node, error: nodeError } = await supabase
      .from('canvas_nodes')
      .select('runtime_config')
      .eq('id', node_id)
      .single();

    if (nodeError || !node) {
      result.error = 'Node not found';
      return finalizePollResult(result, startTime);
    }

    const runtimeConfig = node.runtime_config as NodeRuntimeState | null;

    // Check if monitoring is enabled
    if (!runtimeConfig?.is_enabled) {
      result.error = 'Monitoring is not enabled';
      return finalizePollResult(result, startTime);
    }

    // Check if at least one data source is connected
    const hasSource =
      config.polling_settings.gmail_enabled ||
      config.polling_settings.calendar_enabled;

    if (!hasSource) {
      result.error = 'No data source connected';
      return finalizePollResult(result, startTime);
    }

    // Get processed event IDs to filter duplicates
    const processedIds = new Set(runtimeConfig?.processed_event_ids || []);

    // Fetch events from all configured sources
    const fetchResult = await fetchAllEvents(
      user_id,
      config.polling_settings,
      runtimeConfig?.last_event_at
    );

    result.events_fetched = fetchResult.events.length;

    // If no events, return early (success)
    if (fetchResult.events.length === 0) {
      result.success = true;
      return finalizePollResult(result, startTime);
    }

    // Match events against rules
    const matchResult = matchEventsToRules(
      fetchResult.events,
      config.rules,
      node_id,
      config.auto_reply,
      processedIds
    );

    result.alerts = matchResult.alerts;
    result.alerts_generated = matchResult.alerts.length;
    result.processed_event_ids = matchResult.processed_event_ids;

    // Process auto-replies for matched events
    if (config.auto_reply?.enabled && matchResult.alerts.length > 0) {
      // Get events that generated alerts
      const alertEventIds = new Set(matchResult.alerts.map(a => a.event_id));
      const matchedEvents = fetchResult.events.filter(e => alertEventIds.has(e.id));

      const autoReplyResult = await executeAutoReplies(
        user_id,
        matchedEvents,
        matchResult.alerts,
        config.auto_reply
      );

      result.auto_replies_sent = autoReplyResult.sent_count;
    }

    // Update runtime config with new stats
    await updateNodeRuntimeStats(
      supabase,
      node_id,
      runtimeConfig,
      result
    );

    // Update audit fields for background poll
    if (options.source === 'cron') {
      await updateBackgroundPollAudit(supabase, node_id, null);
    }

    result.success = true;
    return finalizePollResult(result, startTime);

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    result.error = errorMsg;

    // Update audit fields with error (for cron)
    if (options.source === 'cron') {
      const supabase = getSupabaseAdmin();
      await updateBackgroundPollAudit(supabase, node_id, errorMsg);
    }

    return finalizePollResult(result, startTime);
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Finalize poll result with duration
 */
function finalizePollResult(result: PollResult, startTime: number): PollResult {
  result.duration_ms = Date.now() - startTime;

  // Log summary (no plaintext config)
  const status = result.success ? 'success' : 'failed';
  console.log(
    `[SSM Polling] ${result.source} poll ${status}: ` +
    `${result.events_fetched} events, ${result.alerts_generated} alerts, ` +
    `${result.auto_replies_sent} replies, ${result.duration_ms}ms` +
    (result.error ? ` (${result.error})` : '')
  );

  return result;
}

/**
 * Update node runtime stats after polling
 */
async function updateNodeRuntimeStats(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  nodeId: string,
  runtimeConfig: NodeRuntimeState | null,
  result: PollResult
): Promise<void> {
  // Calculate new processed IDs list (keep last 500)
  const existingIds = runtimeConfig?.processed_event_ids || [];
  const allIds = [...existingIds, ...result.processed_event_ids];
  const trimmedIds = allIds.slice(-500);

  await supabase
    .from('canvas_nodes')
    .update({
      runtime_config: {
        ...runtimeConfig,
        events_processed: (runtimeConfig?.events_processed || 0) + result.events_fetched,
        alerts_triggered: (runtimeConfig?.alerts_triggered || 0) + result.alerts_generated,
        last_event_at: new Date().toISOString(),
        processed_event_ids: trimmedIds,
      },
    })
    .eq('id', nodeId);
}

/**
 * Update background poll audit fields
 */
async function updateBackgroundPollAudit(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  nodeId: string,
  error: string | null
): Promise<void> {
  await supabase
    .from('canvas_nodes')
    .update({
      last_background_poll_at: new Date().toISOString(),
      background_poll_error: error,
    })
    .eq('id', nodeId);
}
