/**
 * GET /api/cron/ssm-poll
 *
 * Vercel Cron Job for background SSM polling.
 * Runs every minute to poll all enabled SSM nodes.
 *
 * Architecture:
 * - Uses parallel processing with controlled concurrency (20 nodes at a time)
 * - This allows 100 nodes to be processed in ~10 seconds instead of ~200 seconds
 * - Stays well within Vercel's 60-second timeout limit
 *
 * Security:
 * - Verified with CRON_SECRET header (Vercel sends this automatically)
 * - Checks global kill switch before processing
 * - No plaintext logging of config data
 * - Updates audit fields on every operation
 *
 * Flow:
 * 1. Verify authorization (CRON_SECRET)
 * 2. Check global kill switch
 * 3. Query all nodes where background_polling_enabled = true
 * 4. Process nodes in parallel (20 at a time)
 * 5. Return aggregated results
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptSSMServerConfig } from '@/lib/ssmServerEncryption';
import { pollSSMNode, toPollingConfig, processInParallel } from '@/lib/ssmPolling';
import type { SSMServerConfig } from '@/lib/ssmServerConfig/types';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Maximum nodes to process per cron run.
 * Prevents runaway processing if too many nodes are enabled.
 */
const MAX_NODES_PER_RUN = 100;

/**
 * Number of nodes to process simultaneously.
 * Higher = faster but more API pressure and memory usage.
 * 20 is a safe default that balances speed and reliability.
 */
const CONCURRENCY = 20;

// ============================================================================
// TYPES
// ============================================================================

/** Database node row structure */
interface NodeRow {
  id: string;
  canvas_id: string;
  user_id: string;
  type: string;
  runtime_config: { is_enabled?: boolean } | null;
  server_config_encrypted: string | null;
  server_config_version: number | null;
}

/** Result of processing a single node */
interface NodeProcessResult {
  nodeId: string;
  success: boolean;
  skipped: boolean;
  events: number;
  alerts: number;
  replies: number;
  sheets_rows: number;
  error?: string;
}

/** Aggregated results for all nodes */
interface CronResults {
  nodes_queried: number;
  nodes_processed: number;
  nodes_skipped: number;
  nodes_failed: number;
  total_events: number;
  total_alerts: number;
  total_replies: number;
  total_sheets_rows: number;
  errors: string[];
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
// MAIN HANDLER
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  // -------------------------------------------------------------------------
  // STEP 1: Verify Authorization
  // -------------------------------------------------------------------------
  const authResult = verifyAuthorization(request);
  if (!authResult.authorized) {
    return authResult.response!;
  }

  // -------------------------------------------------------------------------
  // STEP 2: Check Global Kill Switch
  // -------------------------------------------------------------------------
  if (isGlobalKillSwitchEnabled()) {
    console.log('[SSM Cron] Global kill switch is ON - skipping all polling');
    return NextResponse.json({
      success: true,
      message: 'Background polling is disabled globally',
      nodes_processed: 0,
    });
  }

  // -------------------------------------------------------------------------
  // STEP 3: Query Enabled Nodes
  // -------------------------------------------------------------------------
  const queryResult = await queryEnabledNodes();
  if (!queryResult.success) {
    return NextResponse.json({
      success: false,
      error: queryResult.error,
    }, { status: 500 });
  }

  const nodes = queryResult.nodes!;
  console.log(`[SSM Cron] Found ${nodes.length} nodes with background polling enabled`);

  if (nodes.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No nodes to poll',
      nodes_queried: 0,
      nodes_processed: 0,
      duration_ms: Date.now() - startTime,
    });
  }

  // -------------------------------------------------------------------------
  // STEP 4: Process Nodes in Parallel
  // -------------------------------------------------------------------------
  const results = await processNodesInParallel(nodes);

  // -------------------------------------------------------------------------
  // STEP 5: Return Results
  // -------------------------------------------------------------------------
  const duration = Date.now() - startTime;

  console.log(
    `[SSM Cron] Complete: ${results.nodes_processed} processed, ` +
    `${results.nodes_skipped} skipped, ${results.nodes_failed} failed, ` +
    `${results.total_events} events, ${results.total_alerts} alerts, ` +
    `${results.total_replies} replies, ${results.total_sheets_rows} rows logged, ${duration}ms`
  );

  return NextResponse.json({
    success: true,
    ...results,
    duration_ms: duration,
  });
}

// ============================================================================
// STEP 1: AUTHORIZATION
// ============================================================================

interface AuthResult {
  authorized: boolean;
  response?: NextResponse;
}

function verifyAuthorization(request: NextRequest): AuthResult {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // If CRON_SECRET is set, verify it
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('[SSM Cron] Unauthorized request - invalid or missing CRON_SECRET');
    return {
      authorized: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { authorized: true };
}

// ============================================================================
// STEP 2: KILL SWITCH
// ============================================================================

function isGlobalKillSwitchEnabled(): boolean {
  return process.env.SSM_BACKGROUND_POLLING_DISABLED === 'true';
}

// ============================================================================
// STEP 3: QUERY NODES
// ============================================================================

interface QueryResult {
  success: boolean;
  nodes?: NodeRow[];
  error?: string;
}

async function queryEnabledNodes(): Promise<QueryResult> {
  const supabase = getSupabaseAdmin();

  const { data: nodes, error } = await supabase
    .from('canvas_nodes')
    .select(`
      id,
      canvas_id,
      user_id,
      type,
      runtime_config,
      server_config_encrypted,
      server_config_version
    `)
    .eq('background_polling_enabled', true)
    .eq('type', 'SSM_AGENT')
    .limit(MAX_NODES_PER_RUN);

  if (error) {
    console.error('[SSM Cron] Query error:', error.message);
    return { success: false, error: 'Failed to query nodes' };
  }

  return { success: true, nodes: nodes || [] };
}

// ============================================================================
// STEP 4: PARALLEL PROCESSING
// ============================================================================

async function processNodesInParallel(nodes: NodeRow[]): Promise<CronResults> {
  const results: CronResults = {
    nodes_queried: nodes.length,
    nodes_processed: 0,
    nodes_skipped: 0,
    nodes_failed: 0,
    total_events: 0,
    total_alerts: 0,
    total_replies: 0,
    total_sheets_rows: 0,
    errors: [],
  };

  // Process all nodes with controlled concurrency
  const parallelResult = await processInParallel(
    nodes,
    (node) => processSingleNode(node),
    {
      concurrency: CONCURRENCY,
      continueOnError: true,
      label: 'SSM nodes',
    }
  );

  // Aggregate results from all processed nodes
  for (const nodeResult of parallelResult.successes) {
    if (nodeResult.skipped) {
      results.nodes_skipped++;
    } else if (nodeResult.success) {
      results.nodes_processed++;
      results.total_events += nodeResult.events;
      results.total_alerts += nodeResult.alerts;
      results.total_replies += nodeResult.replies;
      results.total_sheets_rows += nodeResult.sheets_rows;
    } else {
      results.nodes_failed++;
      if (nodeResult.error) {
        results.errors.push(`${nodeResult.nodeId}: ${nodeResult.error}`);
      }
    }
  }

  // Add any processing errors (exceptions during node processing)
  for (const error of parallelResult.errors) {
    results.nodes_failed++;
    results.errors.push(`Node at index ${error.index}: ${error.error}`);
  }

  return results;
}

// ============================================================================
// SINGLE NODE PROCESSING
// ============================================================================

async function processSingleNode(node: NodeRow): Promise<NodeProcessResult> {
  const nodeId = node.id;
  const supabase = getSupabaseAdmin();

  // -------------------------------------------------------------------------
  // Check if node is enabled (per-node disable)
  // -------------------------------------------------------------------------
  const runtimeConfig = node.runtime_config;
  if (!runtimeConfig?.is_enabled) {
    return {
      nodeId,
      success: true,
      skipped: true,
      events: 0,
      alerts: 0,
      replies: 0,
      sheets_rows: 0,
    };
  }

  // -------------------------------------------------------------------------
  // Check for encrypted config
  // -------------------------------------------------------------------------
  const encryptedConfig = node.server_config_encrypted;
  if (!encryptedConfig) {
    console.log(`[SSM Cron] Node ${nodeId} has no server config - skipping`);
    return {
      nodeId,
      success: true,
      skipped: true,
      events: 0,
      alerts: 0,
      replies: 0,
      sheets_rows: 0,
    };
  }

  // -------------------------------------------------------------------------
  // Decrypt server config
  // -------------------------------------------------------------------------
  let serverConfig: SSMServerConfig;
  try {
    serverConfig = await decryptSSMServerConfig<SSMServerConfig>(encryptedConfig);
  } catch (decryptError) {
    const errorMsg = decryptError instanceof Error ? decryptError.message : 'Decrypt failed';
    console.error(`[SSM Cron] Node ${nodeId} decrypt error:`, errorMsg);

    // Update audit fields with error
    await updateNodeError(supabase, nodeId, `Decrypt failed: ${errorMsg}`);

    return {
      nodeId,
      success: false,
      skipped: false,
      events: 0,
      alerts: 0,
      replies: 0,
      sheets_rows: 0,
      error: 'Decrypt failed',
    };
  }

  // -------------------------------------------------------------------------
  // Poll the node
  // -------------------------------------------------------------------------
  try {
    const pollingConfig = toPollingConfig(serverConfig);
    const pollResult = await pollSSMNode(pollingConfig, { source: 'cron' });

    if (pollResult.success) {
      return {
        nodeId,
        success: true,
        skipped: false,
        events: pollResult.events_fetched,
        alerts: pollResult.alerts_generated,
        replies: pollResult.auto_replies_sent,
        sheets_rows: pollResult.sheets_rows_logged,
      };
    } else {
      return {
        nodeId,
        success: false,
        skipped: false,
        events: pollResult.events_fetched,
        alerts: pollResult.alerts_generated,
        replies: pollResult.auto_replies_sent,
        sheets_rows: pollResult.sheets_rows_logged,
        error: pollResult.error,
      };
    }
  } catch (pollError) {
    const errorMsg = pollError instanceof Error ? pollError.message : 'Poll failed';
    console.error(`[SSM Cron] Node ${nodeId} poll error:`, errorMsg);

    // Update audit fields with error
    await updateNodeError(supabase, nodeId, errorMsg);

    return {
      nodeId,
      success: false,
      skipped: false,
      events: 0,
      alerts: 0,
      replies: 0,
      sheets_rows: 0,
      error: errorMsg,
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function updateNodeError(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  nodeId: string,
  error: string
): Promise<void> {
  try {
    await supabase
      .from('canvas_nodes')
      .update({
        last_background_poll_at: new Date().toISOString(),
        background_poll_error: error,
      })
      .eq('id', nodeId);
  } catch (updateError) {
    // Don't let audit update failure affect the main flow
    console.error(`[SSM Cron] Failed to update audit for node ${nodeId}`);
  }
}
