/**
 * POST /api/canvas/ssm/server-config
 *
 * Syncs SSM operational config to server-side encrypted storage.
 * Called when user saves SSM node config with monitoring enabled.
 *
 * Flow:
 * 1. Validate user owns the node
 * 2. Encrypt config with server-managed key
 * 3. Store in server_config_encrypted column
 * 4. Update audit fields (version, timestamp)
 *
 * Security:
 * - User must own the node
 * - Config encrypted with server key (from Secret Manager)
 * - No plaintext logging of config data
 * - Audit trail for all syncs
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encryptSSMServerConfig } from '@/lib/ssmServerEncryption';
import type { SSMServerConfig, SSMPollingSettings } from '@/lib/ssmServerConfig/types';
import type { SSMRulesConfig, SSMResponseTemplate } from '@/app/canvas/types/ssm';
import type { SSMAutoReplyConfig } from '@/app/canvas/features/ssm-agent/features/auto-reply/types';

// ============================================================================
// TYPES
// ============================================================================

interface SyncServerConfigRequest {
  /** User ID (verified against node ownership) */
  userId: string;
  /** Canvas ID */
  canvasId: string;
  /** Node ID */
  nodeId: string;
  /** Rules configuration */
  rules: SSMRulesConfig;
  /** Response templates */
  response_templates: SSMResponseTemplate[];
  /** Auto-reply configuration (optional) */
  auto_reply?: SSMAutoReplyConfig;
  /** Polling settings */
  polling_settings: Partial<SSMPollingSettings>;
  /** Enable background polling */
  enable_background_polling: boolean;
}

interface SyncServerConfigResponse {
  success: boolean;
  error?: string;
  /** Updated version number */
  version?: number;
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

export async function POST(request: NextRequest): Promise<NextResponse<SyncServerConfigResponse>> {
  const startTime = Date.now();

  try {
    const body: SyncServerConfigRequest = await request.json();
    const {
      userId,
      canvasId,
      nodeId,
      rules,
      response_templates,
      auto_reply,
      polling_settings,
      enable_background_polling,
    } = body;

    // Validate required fields
    if (!userId || !canvasId || !nodeId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: userId, canvasId, or nodeId',
      }, { status: 400 });
    }

    if (!rules) {
      return NextResponse.json({
        success: false,
        error: 'Missing required field: rules',
      }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Verify user owns the canvas
    const { data: canvas, error: canvasError } = await supabase
      .from('canvases')
      .select('id, user_id')
      .eq('id', canvasId)
      .single();

    if (canvasError || !canvas) {
      console.log('[SSM Server Config] Canvas not found:', canvasId);
      return NextResponse.json({
        success: false,
        error: 'Canvas not found',
      }, { status: 404 });
    }

    if (canvas.user_id !== userId) {
      console.log('[SSM Server Config] User does not own canvas:', { userId, canvasUserId: canvas.user_id });
      return NextResponse.json({
        success: false,
        error: 'Unauthorized: you do not own this canvas',
      }, { status: 403 });
    }

    // Get current node to verify it exists and get current version
    const { data: node, error: nodeError } = await supabase
      .from('canvas_nodes')
      .select('id, canvas_id, server_config_version')
      .eq('id', nodeId)
      .eq('canvas_id', canvasId)
      .single();

    if (nodeError || !node) {
      console.log('[SSM Server Config] Node not found:', nodeId);
      return NextResponse.json({
        success: false,
        error: 'Node not found',
      }, { status: 404 });
    }

    // Calculate new version
    const currentVersion = (node.server_config_version as number) || 0;
    const newVersion = currentVersion + 1;

    // Build polling settings with defaults
    const fullPollingSettings: SSMPollingSettings = {
      gmail_enabled: polling_settings.gmail_enabled ?? false,
      gmail_connection_id: polling_settings.gmail_connection_id,
      gmail_history_id: polling_settings.gmail_history_id,
      calendar_enabled: polling_settings.calendar_enabled ?? false,
      calendar_connection_id: polling_settings.calendar_connection_id,
      calendar_sync_token: polling_settings.calendar_sync_token,
      interval_minutes: polling_settings.interval_minutes ?? 1,
    };

    // Build server config
    const serverConfig: SSMServerConfig = {
      rules,
      response_templates: response_templates || [],
      auto_reply,
      polling_settings: fullPollingSettings,
      version: newVersion,
      user_id: userId,
      node_id: nodeId,
      canvas_id: canvasId,
      synced_at: new Date().toISOString(),
    };

    // Encrypt config with server key
    // SECURITY: Never log the config content
    let encryptedConfig: string;
    try {
      encryptedConfig = await encryptSSMServerConfig(serverConfig);
    } catch (encryptError) {
      console.error('[SSM Server Config] Encryption failed:', encryptError instanceof Error ? encryptError.message : 'Unknown error');
      return NextResponse.json({
        success: false,
        error: 'Failed to encrypt server config. Please try again.',
      }, { status: 500 });
    }

    // Update node with encrypted config and audit fields
    const { error: updateError } = await supabase
      .from('canvas_nodes')
      .update({
        server_config_encrypted: encryptedConfig,
        server_config_version: newVersion,
        server_config_updated_at: new Date().toISOString(),
        background_polling_enabled: enable_background_polling,
        // Clear any previous poll error when config is updated
        background_poll_error: null,
      })
      .eq('id', nodeId);

    if (updateError) {
      console.error('[SSM Server Config] Update failed:', updateError.message);
      return NextResponse.json({
        success: false,
        error: 'Failed to save server config',
      }, { status: 500 });
    }

    const duration = Date.now() - startTime;
    console.log(`[SSM Server Config] Synced node ${nodeId} (version ${newVersion}) in ${duration}ms`);

    return NextResponse.json({
      success: true,
      version: newVersion,
    });

  } catch (error) {
    console.error('[SSM Server Config] Error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({
      success: false,
      error: 'Failed to sync server config',
    }, { status: 500 });
  }
}

/**
 * DELETE /api/canvas/ssm/server-config
 *
 * Disables background polling and clears server config.
 * Called when user disables monitoring or deletes SSM node.
 */
export async function DELETE(request: NextRequest): Promise<NextResponse<SyncServerConfigResponse>> {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const canvasId = searchParams.get('canvasId');
    const nodeId = searchParams.get('nodeId');

    if (!userId || !canvasId || !nodeId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required query params: userId, canvasId, or nodeId',
      }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Verify user owns the canvas
    const { data: canvas, error: canvasError } = await supabase
      .from('canvases')
      .select('id, user_id')
      .eq('id', canvasId)
      .single();

    if (canvasError || !canvas) {
      return NextResponse.json({
        success: false,
        error: 'Canvas not found',
      }, { status: 404 });
    }

    if (canvas.user_id !== userId) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized: you do not own this canvas',
      }, { status: 403 });
    }

    // Disable background polling and clear encrypted config
    const { error: updateError } = await supabase
      .from('canvas_nodes')
      .update({
        background_polling_enabled: false,
        server_config_encrypted: null,
        background_poll_error: null,
      })
      .eq('id', nodeId)
      .eq('canvas_id', canvasId);

    if (updateError) {
      console.error('[SSM Server Config] Delete failed:', updateError.message);
      return NextResponse.json({
        success: false,
        error: 'Failed to clear server config',
      }, { status: 500 });
    }

    console.log(`[SSM Server Config] Cleared config for node ${nodeId}`);

    return NextResponse.json({
      success: true,
    });

  } catch (error) {
    console.error('[SSM Server Config] Delete error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({
      success: false,
      error: 'Failed to clear server config',
    }, { status: 500 });
  }
}
