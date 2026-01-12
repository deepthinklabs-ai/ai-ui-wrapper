/**
 * GET /api/cron/ssm-poll
 *
 * Vercel Cron Job for background SSM polling.
 * Runs every minute to poll all enabled SSM nodes.
 *
 * Security:
 * - Verified with CRON_SECRET header
 * - Checks global kill switch before processing
 * - No plaintext logging of config data
 * - Updates audit fields on every operation
 *
 * Flow:
 * 1. Check global kill switch
 * 2. Query all nodes where background_polling_enabled = true
 * 3. For each node:
 *    - Check per-node disable (runtime_config.is_enabled)
 *    - Decrypt server_config_encrypted
 *    - Call pollSSMNode()
 *    - Update audit fields
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { decryptSSMServerConfig } from '@/lib/ssmServerEncryption';
import { pollSSMNode, toPollingConfig } from '@/lib/ssmPolling';
import type { SSMServerConfig } from '@/lib/ssmServerConfig/types';

// ============================================================================
// CONSTANTS
// ============================================================================

// Maximum nodes to process per cron run (to stay within Vercel timeout)
const MAX_NODES_PER_RUN = 50;

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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const startTime = Date.now();

  // Verify cron secret (Vercel sends this header)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    console.log('[SSM Cron] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check global kill switch
  if (process.env.SSM_BACKGROUND_POLLING_DISABLED === 'true') {
    console.log('[SSM Cron] Global kill switch is ON - skipping all polling');
    return NextResponse.json({
      success: true,
      message: 'Background polling is disabled globally',
      nodes_processed: 0,
    });
  }

  const supabase = getSupabaseAdmin();
  const results = {
    nodes_queried: 0,
    nodes_processed: 0,
    nodes_skipped: 0,
    nodes_failed: 0,
    total_events: 0,
    total_alerts: 0,
    total_replies: 0,
    errors: [] as string[],
  };

  try {
    // Query all nodes with background polling enabled
    const { data: nodes, error: queryError } = await supabase
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

    if (queryError) {
      console.error('[SSM Cron] Query error:', queryError.message);
      return NextResponse.json({
        success: false,
        error: 'Failed to query nodes',
      }, { status: 500 });
    }

    results.nodes_queried = nodes?.length || 0;
    console.log(`[SSM Cron] Found ${results.nodes_queried} nodes with background polling enabled`);

    if (!nodes || nodes.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No nodes to poll',
        ...results,
        duration_ms: Date.now() - startTime,
      });
    }

    // Process each node
    for (const node of nodes) {
      const nodeId = node.id;

      try {
        // Check per-node disable
        const runtimeConfig = node.runtime_config as { is_enabled?: boolean } | null;
        if (!runtimeConfig?.is_enabled) {
          results.nodes_skipped++;
          continue;
        }

        // Check for encrypted config
        const encryptedConfig = node.server_config_encrypted;
        if (!encryptedConfig) {
          console.log(`[SSM Cron] Node ${nodeId} has no server config`);
          results.nodes_skipped++;
          continue;
        }

        // Decrypt server config
        // SECURITY: Config is decrypted in memory only, never logged
        let serverConfig: SSMServerConfig;
        try {
          serverConfig = await decryptSSMServerConfig<SSMServerConfig>(encryptedConfig);
        } catch (decryptError) {
          const errorMsg = decryptError instanceof Error ? decryptError.message : 'Decrypt failed';
          console.error(`[SSM Cron] Node ${nodeId} decrypt error:`, errorMsg);
          results.nodes_failed++;
          results.errors.push(`${nodeId}: decrypt failed`);

          // Update audit fields with error
          await supabase
            .from('canvas_nodes')
            .update({
              last_background_poll_at: new Date().toISOString(),
              background_poll_error: `Decrypt failed: ${errorMsg}`,
            })
            .eq('id', nodeId);

          continue;
        }

        // Poll the node
        const pollingConfig = toPollingConfig(serverConfig);
        const pollResult = await pollSSMNode(pollingConfig, { source: 'cron' });

        if (pollResult.success) {
          results.nodes_processed++;
          results.total_events += pollResult.events_fetched;
          results.total_alerts += pollResult.alerts_generated;
          results.total_replies += pollResult.auto_replies_sent;
        } else {
          results.nodes_failed++;
          if (pollResult.error) {
            results.errors.push(`${nodeId}: ${pollResult.error}`);
          }
        }

      } catch (nodeError) {
        const errorMsg = nodeError instanceof Error ? nodeError.message : 'Unknown error';
        console.error(`[SSM Cron] Node ${nodeId} error:`, errorMsg);
        results.nodes_failed++;
        results.errors.push(`${nodeId}: ${errorMsg}`);

        // Update audit fields with error
        await supabase
          .from('canvas_nodes')
          .update({
            last_background_poll_at: new Date().toISOString(),
            background_poll_error: errorMsg,
          })
          .eq('id', nodeId);
      }
    }

    const duration = Date.now() - startTime;
    console.log(
      `[SSM Cron] Complete: ${results.nodes_processed} processed, ` +
      `${results.nodes_skipped} skipped, ${results.nodes_failed} failed, ` +
      `${results.total_events} events, ${results.total_alerts} alerts, ` +
      `${results.total_replies} replies, ${duration}ms`
    );

    return NextResponse.json({
      success: true,
      ...results,
      duration_ms: duration,
    });

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SSM Cron] Fatal error:', errorMsg);
    return NextResponse.json({
      success: false,
      error: errorMsg,
      ...results,
      duration_ms: Date.now() - startTime,
    }, { status: 500 });
  }
}
