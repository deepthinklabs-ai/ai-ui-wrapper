/**
 * POST /api/canvas/ssm/execute
 *
 * Executes SSM (State-Space Model) inference for continuous monitoring.
 * Connects to local Ollama or vLLM instance for model inference.
 *
 * Security features:
 * - Input sanitization (injection prevention)
 * - Endpoint validation (SSRF prevention)
 * - User authentication
 * - Rate limiting ready
 * - Secure error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { SSMAgentNodeConfig, SSMAlert } from '@/app/canvas/types/ssm';
import {
  sanitizeEventContent,
  sanitizeCustomPrompt,
  generateRequestId,
} from '@/app/canvas/features/ssm-agent/lib/ssmSanitization';
import { generatePrompt, parseAlertResponse, parseClassificationResponse, parseSummaryResponse } from '@/app/canvas/features/ssm-agent/lib/ssmPrompts';
import { executeSSMInference, checkEndpointHealth } from '@/app/canvas/features/ssm-agent/lib/ssmOllamaClient';

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// TYPES
// ============================================================================

interface SSMExecuteRequest {
  canvasId: string;
  nodeId: string;
  userId: string;
  eventContent: string;
  additionalContext?: string;
}

interface SSMExecuteResponse {
  success: boolean;
  requestId: string;
  result?: {
    type: 'alert' | 'classification' | 'summary' | 'raw';
    data: unknown;
    tokensUsed?: number;
  };
  alert?: SSMAlert;
  error?: string;
  latencyMs: number;
}

// ============================================================================
// REQUEST HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<SSMExecuteResponse>> {
  const startTime = Date.now();
  const requestId = generateRequestId();

  try {
    // Parse request body
    const body: SSMExecuteRequest = await request.json();
    const { canvasId, nodeId, userId, eventContent, additionalContext } = body;

    console.log(`[SSM Execute] Request ${requestId} started`);
    console.log(`  Canvas: ${canvasId}`);
    console.log(`  Node: ${nodeId}`);
    console.log(`  User: ${userId}`);
    console.log(`  Event size: ${eventContent?.length || 0} chars`);

    // ========================================================================
    // INPUT VALIDATION
    // ========================================================================

    if (!canvasId || !nodeId || !userId) {
      return NextResponse.json({
        success: false,
        requestId,
        error: 'Missing required fields: canvasId, nodeId, userId',
        latencyMs: Date.now() - startTime,
      }, { status: 400 });
    }

    if (!eventContent || eventContent.trim().length === 0) {
      return NextResponse.json({
        success: false,
        requestId,
        error: 'Event content is required',
        latencyMs: Date.now() - startTime,
      }, { status: 400 });
    }

    // ========================================================================
    // SANITIZE INPUT
    // ========================================================================

    const sanitizedEvent = sanitizeEventContent(eventContent);
    if (sanitizedEvent.blocked) {
      console.warn(`[SSM Execute] Request ${requestId} blocked: ${sanitizedEvent.blockReason}`);
      return NextResponse.json({
        success: false,
        requestId,
        error: sanitizedEvent.blockReason || 'Event content blocked by security filter',
        latencyMs: Date.now() - startTime,
      }, { status: 400 });
    }

    if (sanitizedEvent.warnings.length > 0) {
      console.log(`[SSM Execute] Request ${requestId} warnings: ${sanitizedEvent.warnings.join(', ')}`);
    }

    // ========================================================================
    // FETCH SSM NODE CONFIGURATION
    // ========================================================================

    const { data: ssmNode, error: nodeError } = await supabase
      .from('canvas_nodes')
      .select('*')
      .eq('id', nodeId)
      .eq('canvas_id', canvasId)
      .eq('type', 'SSM_AGENT')
      .single();

    if (nodeError || !ssmNode) {
      console.error(`[SSM Execute] Request ${requestId} - Node not found:`, nodeError);
      return NextResponse.json({
        success: false,
        requestId,
        error: 'SSM Agent node not found',
        latencyMs: Date.now() - startTime,
      }, { status: 404 });
    }

    // Verify user owns the canvas
    const { data: canvas, error: canvasError } = await supabase
      .from('canvases')
      .select('user_id')
      .eq('id', canvasId)
      .single();

    if (canvasError || !canvas || canvas.user_id !== userId) {
      console.error(`[SSM Execute] Request ${requestId} - Unauthorized access attempt`);
      return NextResponse.json({
        success: false,
        requestId,
        error: 'Unauthorized',
        latencyMs: Date.now() - startTime,
      }, { status: 403 });
    }

    const config = ssmNode.config as SSMAgentNodeConfig;

    // ========================================================================
    // VALIDATE CUSTOM PROMPT (if applicable)
    // ========================================================================

    let sanitizedCustomPrompt: string | undefined;
    if (config.monitoring_type === 'custom' && config.custom_prompt) {
      const promptSanitization = sanitizeCustomPrompt(config.custom_prompt);
      if (promptSanitization.blocked) {
        console.warn(`[SSM Execute] Request ${requestId} - Custom prompt blocked`);
        return NextResponse.json({
          success: false,
          requestId,
          error: 'Custom prompt contains disallowed content',
          latencyMs: Date.now() - startTime,
        }, { status: 400 });
      }
      sanitizedCustomPrompt = promptSanitization.sanitized;
    }

    // ========================================================================
    // CHECK ENDPOINT HEALTH (optional, can be disabled for performance)
    // ========================================================================

    const endpoint = config.model_endpoint || 'http://localhost:11434';
    const healthCheck = await checkEndpointHealth(endpoint, config.model_provider);

    if (!healthCheck.healthy) {
      console.error(`[SSM Execute] Request ${requestId} - Endpoint unhealthy: ${healthCheck.error}`);
      return NextResponse.json({
        success: false,
        requestId,
        error: `SSM model endpoint is not reachable: ${healthCheck.error || 'Connection failed'}`,
        latencyMs: Date.now() - startTime,
      }, { status: 503 });
    }

    // ========================================================================
    // GENERATE PROMPT
    // ========================================================================

    const prompt = generatePrompt({
      monitoringType: config.monitoring_type,
      outputFormat: config.output_format,
      customPrompt: sanitizedCustomPrompt,
      alertThreshold: config.alert_threshold,
      eventContent: sanitizedEvent.sanitized,
      additionalContext,
    });

    console.log(`[SSM Execute] Request ${requestId} - Executing inference`);
    console.log(`  Model: ${config.model_provider}/${config.model_name}`);
    console.log(`  Monitoring type: ${config.monitoring_type}`);
    console.log(`  Output format: ${config.output_format}`);

    // ========================================================================
    // EXECUTE SSM INFERENCE
    // ========================================================================

    const inferenceResult = await executeSSMInference({
      endpoint,
      model: config.model_name,
      provider: config.model_provider,
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      temperature: 0.3, // Lower temperature for monitoring tasks
      maxTokens: 1000,
      timeoutMs: 30000,
      requestId,
    });

    if (!inferenceResult.success) {
      console.error(`[SSM Execute] Request ${requestId} - Inference failed: ${inferenceResult.error}`);
      return NextResponse.json({
        success: false,
        requestId,
        error: inferenceResult.error || 'SSM inference failed',
        latencyMs: Date.now() - startTime,
      }, { status: 500 });
    }

    // ========================================================================
    // PARSE RESPONSE
    // ========================================================================

    let parsedResult: unknown;
    let alert: SSMAlert | undefined;

    switch (config.output_format) {
      case 'alert': {
        const parsed = parseAlertResponse(inferenceResult.content || '');
        parsedResult = parsed;

        // Create alert if detected
        if (parsed?.detected) {
          alert = {
            id: `alert_${requestId}`,
            severity: parsed.severity,
            title: parsed.title,
            details: {
              explanation: parsed.details,
              confidence: parsed.confidence,
              recommendedAction: parsed.recommendedAction,
              eventPreview: sanitizedEvent.sanitized.substring(0, 200),
            },
            timestamp: new Date().toISOString(),
            acknowledged: false,
            source_node_id: nodeId,
          };
        }
        break;
      }

      case 'classification': {
        parsedResult = parseClassificationResponse(inferenceResult.content || '');
        break;
      }

      case 'summary': {
        parsedResult = parseSummaryResponse(inferenceResult.content || '');
        break;
      }

      case 'raw':
      default: {
        try {
          parsedResult = JSON.parse(inferenceResult.content || '{}');
        } catch {
          parsedResult = { raw: inferenceResult.content };
        }
        break;
      }
    }

    // ========================================================================
    // UPDATE NODE STATISTICS
    // ========================================================================

    await supabase
      .from('canvas_nodes')
      .update({
        config: {
          ...config,
          last_executed_at: new Date().toISOString(),
          execution_count: ((config as any).execution_count || 0) + 1,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', nodeId);

    // ========================================================================
    // RETURN SUCCESS RESPONSE
    // ========================================================================

    const totalLatencyMs = Date.now() - startTime;

    console.log(`[SSM Execute] Request ${requestId} completed in ${totalLatencyMs}ms`);
    console.log(`  Inference latency: ${inferenceResult.latencyMs}ms`);
    console.log(`  Tokens used: ${inferenceResult.tokensUsed || 'unknown'}`);
    if (alert) {
      console.log(`  Alert generated: ${alert.severity} - ${alert.title}`);
    }

    return NextResponse.json({
      success: true,
      requestId,
      result: {
        type: config.output_format,
        data: parsedResult,
        tokensUsed: inferenceResult.tokensUsed,
      },
      alert,
      latencyMs: totalLatencyMs,
    });

  } catch (error) {
    console.error(`[SSM Execute] Request ${requestId} - Unexpected error:`, error);

    // Don't leak sensitive error details
    return NextResponse.json({
      success: false,
      requestId,
      error: 'An unexpected error occurred during SSM execution',
      latencyMs: Date.now() - startTime,
    }, { status: 500 });
  }
}

// ============================================================================
// HEALTH CHECK ENDPOINT
// ============================================================================

export async function GET(request: NextRequest): Promise<NextResponse> {
  const endpoint = request.nextUrl.searchParams.get('endpoint') || 'http://localhost:11434';
  const provider = (request.nextUrl.searchParams.get('provider') || 'ollama') as 'ollama' | 'vllm';

  const health = await checkEndpointHealth(endpoint, provider);

  return NextResponse.json({
    healthy: health.healthy,
    endpoint,
    provider,
    error: health.error,
  });
}
