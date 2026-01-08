/**
 * POST /api/canvas/ssm/training/finalize
 *
 * Finalizes a training session and generates monitoring rules
 * from the conversation history.
 *
 * Architecture:
 * - Takes the training conversation and extracted info
 * - Uses LLM to generate structured rules
 * - Returns rules in SSMRulesConfig format
 */

import { NextRequest, NextResponse } from 'next/server';
import type {
  SSMFinalizeTrainingRequest,
  SSMFinalizeTrainingResponse,
  SSMTrainingPhase,
  SSMTrainingMessage,
  SSMExtractedInfo,
} from '@/app/canvas/features/ssm-agent/types/training';
import type {
  SSMRulesConfig,
  SSMResponseTemplate,
  SSMKeywordRule,
  SSMPatternRule,
  SSMConditionRule,
} from '@/app/canvas/types/ssm';
import { RULES_GENERATION_PROMPT } from '@/app/canvas/features/ssm-agent/lib/trainingPrompts';

// ============================================================================
// SESSION ACCESS (shared with training route via global)
// ============================================================================

// Note: In production, this should be Redis/DB
// The training route defines the global, we just access it
function getSessionStore() {
  // Access the global store set by training route
  const store = (global as { ssmTrainingSessions?: Record<string, {
    nodeId: string;
    canvasId: string;
    userId: string;
    phase: SSMTrainingPhase;
    messages: SSMTrainingMessage[];
    extractedInfo: SSMExtractedInfo;
    startedAt: string;
    lastActivityAt: string;
  }> }).ssmTrainingSessions;

  return store || {};
}

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<SSMFinalizeTrainingResponse>> {
  try {
    const body: SSMFinalizeTrainingRequest = await request.json();
    const { sessionId, nodeId, provider } = body;

    if (!sessionId || !nodeId) {
      return NextResponse.json({
        success: false,
        monitoringDescription: '',
        rules: { keywords: [], patterns: [], conditions: [] },
        responseTemplates: [],
        error: 'Missing required fields',
      }, { status: 400 });
    }

    // Get session from store
    const sessions = getSessionStore();
    const session = sessions[sessionId];

    if (!session) {
      return NextResponse.json({
        success: false,
        monitoringDescription: '',
        rules: { keywords: [], patterns: [], conditions: [] },
        responseTemplates: [],
        error: 'Session not found',
      }, { status: 404 });
    }

    // Build conversation string
    const conversationText = session.messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join('\n\n');

    // Build extracted info string
    const extractedInfoText = JSON.stringify(session.extractedInfo, null, 2);

    // Build prompt
    const prompt = RULES_GENERATION_PROMPT
      .replace('{conversation}', conversationText)
      .replace('{extractedInfo}', extractedInfoText);

    // Generate rules using AI
    const result = await generateRulesWithAI(prompt, provider);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        monitoringDescription: '',
        rules: { keywords: [], patterns: [], conditions: [] },
        responseTemplates: [],
        error: result.error || 'Failed to generate rules',
      }, { status: 500 });
    }

    // Clean up session
    delete sessions[sessionId];

    return NextResponse.json({
      success: true,
      monitoringDescription: result.monitoringDescription || '',
      rules: result.rules || { keywords: [], patterns: [], conditions: [] },
      responseTemplates: result.responseTemplates || getDefaultResponseTemplates(),
    });

  } catch (error) {
    console.error('[SSM Training Finalize] Error:', error);
    return NextResponse.json({
      success: false,
      monitoringDescription: '',
      rules: { keywords: [], patterns: [], conditions: [] },
      responseTemplates: [],
      error: 'Failed to finalize training',
    }, { status: 500 });
  }
}

// ============================================================================
// AI GENERATION
// ============================================================================

interface GenerationResult {
  success: boolean;
  monitoringDescription?: string;
  rules?: SSMRulesConfig;
  responseTemplates?: SSMResponseTemplate[];
  error?: string;
}

async function generateRulesWithAI(
  prompt: string,
  provider: 'claude' | 'openai'
): Promise<GenerationResult> {
  if (provider === 'claude') {
    return generateWithClaude(prompt);
  } else {
    return generateWithOpenAI(prompt);
  }
}

async function generateWithClaude(prompt: string): Promise<GenerationResult> {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('[SSM Finalize] Missing ANTHROPIC_API_KEY');
      return { success: false, error: 'Claude API key not configured' };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SSM Finalize] Claude API error:', response.status, errorText);
      return { success: false, error: `Claude API error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    return parseGeneratedRules(content);
  } catch (error) {
    console.error('[SSM Finalize] Claude error:', error);
    return { success: false, error: 'Failed to call Claude API' };
  }
}

async function generateWithOpenAI(prompt: string): Promise<GenerationResult> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        messages: [
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!response.ok) {
      console.error('[SSM Finalize] OpenAI API error:', await response.text());
      return { success: false, error: 'OpenAI API error' };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return parseGeneratedRules(content);
  } catch (error) {
    console.error('[SSM Finalize] OpenAI error:', error);
    return { success: false, error: 'Failed to call OpenAI API' };
  }
}

// ============================================================================
// PARSING
// ============================================================================

function parseGeneratedRules(content: string): GenerationResult {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[SSM Finalize] No JSON found in response');
      return {
        success: true,
        monitoringDescription: 'Custom monitoring based on training',
        rules: generateFallbackRules(content),
        responseTemplates: getDefaultResponseTemplates(),
      };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and transform rules
    const rules: SSMRulesConfig = {
      keywords: (parsed.rules?.keywords || []).map((k: any, i: number) => ({
        id: `kw_${Date.now()}_${i}`,
        keyword: k.keyword || k,
        caseSensitive: k.caseSensitive ?? false,
        severity: validateSeverity(k.severity),
        enabled: true,
      })),
      patterns: (parsed.rules?.patterns || []).map((p: any, i: number) => ({
        id: `pt_${Date.now()}_${i}`,
        name: p.name || `Pattern ${i + 1}`,
        pattern: p.pattern || p,
        description: p.description || '',
        severity: validateSeverity(p.severity),
        enabled: true,
      })),
      conditions: (parsed.rules?.conditions || []).map((c: any, i: number) => ({
        id: `cd_${Date.now()}_${i}`,
        field: c.field || 'content',
        operator: c.operator || 'contains',
        value: c.value || '',
        severity: validateSeverity(c.severity),
        enabled: true,
      })),
    };

    return {
      success: true,
      monitoringDescription: parsed.monitoring_description || 'Custom monitoring based on training',
      rules,
      responseTemplates: parsed.response_templates?.length
        ? parsed.response_templates
        : getDefaultResponseTemplates(),
    };

  } catch (error) {
    console.error('[SSM Finalize] Parse error:', error);
    return {
      success: true,
      monitoringDescription: 'Custom monitoring based on training',
      rules: generateFallbackRules(content),
      responseTemplates: getDefaultResponseTemplates(),
    };
  }
}

function validateSeverity(severity: string): 'info' | 'warning' | 'critical' {
  if (['info', 'warning', 'critical'].includes(severity)) {
    return severity as 'info' | 'warning' | 'critical';
  }
  return 'warning';
}

function generateFallbackRules(content: string): SSMRulesConfig {
  // Extract any keywords mentioned in the conversation
  const commonThreatKeywords = [
    'urgent', 'phishing', 'suspicious', 'password', 'verify',
    'account', 'security', 'click here', 'wire transfer',
  ];

  const keywords: SSMKeywordRule[] = commonThreatKeywords
    .filter(k => content.toLowerCase().includes(k))
    .map((keyword, i) => ({
      id: `kw_fallback_${i}`,
      keyword,
      caseSensitive: false,
      severity: 'warning' as const,
      enabled: true,
    }));

  return {
    keywords,
    patterns: [],
    conditions: [],
  };
}

function getDefaultResponseTemplates(): SSMResponseTemplate[] {
  return [
    {
      severity: 'info',
      title: 'Information: {matched_rule}',
      message: 'Event logged: {content_preview}',
      action: 'log',
    },
    {
      severity: 'warning',
      title: 'Warning: {matched_rule}',
      message: 'Potential issue detected in: {source}. Content: {content_preview}',
      action: 'alert',
    },
    {
      severity: 'critical',
      title: 'CRITICAL: {matched_rule}',
      message: 'High-priority alert from {source}. Immediate attention required. Content: {content_preview}',
      action: 'forward_to_ai',
    },
  ];
}
