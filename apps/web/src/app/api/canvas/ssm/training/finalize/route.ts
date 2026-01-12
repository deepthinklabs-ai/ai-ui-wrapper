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
import { createClient } from '@supabase/supabase-js';
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
import type { SSMAutoReplyConfig } from '@/app/canvas/features/ssm-agent/features/auto-reply/types';
import { DEFAULT_AUTO_REPLY_CONFIG } from '@/app/canvas/features/ssm-agent/features/auto-reply/defaults';
import { RULES_GENERATION_PROMPT } from '@/app/canvas/features/ssm-agent/lib/trainingPrompts';
import { getProviderKey } from '@/lib/secretManager/getKey';

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

    // Verify user has Pro tier (SSM is a Pro feature)
    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', session.userId)
      .single();

    if (!profile || profile.tier !== 'pro') {
      return NextResponse.json({
        success: false,
        monitoringDescription: '',
        rules: { keywords: [], patterns: [], conditions: [] },
        responseTemplates: [],
        error: 'Polling Monitor requires Pro subscription',
      }, { status: 403 });
    }

    // Get user's API key for the selected provider
    const providerKey = provider === 'claude' ? 'claude' : 'openai';
    const apiKey = await getProviderKey(session.userId, providerKey);
    if (!apiKey) {
      const providerName = provider === 'claude' ? 'Claude' : 'OpenAI';
      return NextResponse.json({
        success: false,
        monitoringDescription: '',
        rules: { keywords: [], patterns: [], conditions: [] },
        responseTemplates: [],
        error: `Please configure your ${providerName} API key in Settings for training.`,
      }, { status: 403 });
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

    // Generate rules using AI, passing conversation text for email extraction
    const result = await generateRulesWithAI(prompt, provider, apiKey, conversationText);

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
      autoReply: result.autoReply,
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
  autoReply?: SSMAutoReplyConfig;
  error?: string;
}

async function generateRulesWithAI(
  prompt: string,
  provider: 'claude' | 'openai',
  apiKey: string,
  conversationText: string
): Promise<GenerationResult> {
  if (provider === 'claude') {
    return generateWithClaude(prompt, apiKey, conversationText);
  } else {
    return generateWithOpenAI(prompt, apiKey, conversationText);
  }
}

async function generateWithClaude(prompt: string, apiKey: string, conversationText: string): Promise<GenerationResult> {
  try {
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

    return parseGeneratedRules(content, conversationText);
  } catch (error) {
    console.error('[SSM Finalize] Claude error:', error);
    return { success: false, error: 'Failed to call Claude API' };
  }
}

async function generateWithOpenAI(prompt: string, apiKey: string, conversationText: string): Promise<GenerationResult> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
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
      const errorText = await response.text();
      console.error('[SSM Finalize] OpenAI API error:', response.status, errorText);
      return { success: false, error: `OpenAI API error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return parseGeneratedRules(content, conversationText);
  } catch (error) {
    console.error('[SSM Finalize] OpenAI error:', error);
    return { success: false, error: 'Failed to call OpenAI API' };
  }
}

// ============================================================================
// PARSING
// ============================================================================

function parseGeneratedRules(content: string, conversationText: string): GenerationResult {
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

    // Parse auto_reply configuration if present
    let autoReply: SSMAutoReplyConfig | undefined;

    // IMPORTANT: Extract notification recipient from the CONVERSATION TEXT, not the AI-generated summary
    // The user's original request like "send email to dalbin25@gmail.com" is in the conversation
    const notificationRecipient = extractNotificationRecipient(conversationText);
    console.log(`[SSM Finalize] Extracted notification recipient from conversation: ${notificationRecipient || 'none'}`);
    const monitoringDescription = parsed.monitoring_description || '';

    if (parsed.auto_reply?.enabled || notificationRecipient) {
      autoReply = {
        enabled: true,
        template: {
          subject: parsed.auto_reply?.template?.subject || 'Re: {subject}',
          body: parsed.auto_reply?.template?.body || 'Thank you for your message. We have received it and will respond shortly.',
          signature: parsed.auto_reply?.template?.signature || '',
          includeOriginal: parsed.auto_reply?.template?.includeOriginal ?? false,
        },
        conditions: {
          severities: parsed.auto_reply?.conditions?.severities || ['info', 'warning', 'critical'],
          excludeSenders: parsed.auto_reply?.conditions?.excludeSenders || ['noreply@', 'no-reply@', 'automated@'],
        },
        rateLimit: {
          maxRepliesPerSender: parsed.auto_reply?.rateLimit?.maxRepliesPerSender || 1,
          windowMinutes: parsed.auto_reply?.rateLimit?.windowMinutes || 60,
          sentReplies: {},
        },
        // Add notification recipient for calendar events
        notificationRecipient,
      };
      console.log(`[SSM Finalize] Auto-reply config created${notificationRecipient ? `, notification recipient: ${notificationRecipient}` : ''}`);
    }

    return {
      success: true,
      monitoringDescription: parsed.monitoring_description || 'Custom monitoring based on training',
      rules,
      responseTemplates: parsed.response_templates?.length
        ? parsed.response_templates
        : getDefaultResponseTemplates(),
      autoReply,
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

/**
 * Trim non-alphanumeric characters from start and end of string.
 * Uses simple loop instead of regex to avoid ReDoS vulnerabilities.
 */
function trimNonAlphanumeric(str: string): string {
  const isAlphanumeric = (char: string) => /[a-zA-Z0-9]/.test(char);

  let start = 0;
  let end = str.length;

  while (start < end && !isAlphanumeric(str[start])) start++;
  while (end > start && !isAlphanumeric(str[end - 1])) end--;

  return str.slice(start, end);
}

/**
 * Extract notification recipient email from description.
 * Looks for patterns like:
 * - "send email to user@example.com"
 * - "email user@example.com"
 * - "notify user@example.com"
 */
function extractNotificationRecipient(description: string): string | undefined {
  // Split by whitespace and find words containing @
  // This avoids ReDoS vulnerabilities from complex email regex patterns
  const words = description.split(/\s+/);

  for (const word of words) {
    // Quick check: must contain @ and have content on both sides
    const atIndex = word.indexOf('@');
    if (atIndex <= 0 || atIndex >= word.length - 1) continue;

    // Clean up punctuation that might be attached (e.g., "email@example.com.")
    // Use simple loop instead of regex to avoid ReDoS
    const cleaned = trimNonAlphanumeric(word);

    // Validate basic email structure: local@domain.tld
    const parts = cleaned.split('@');
    if (parts.length !== 2) continue;

    const [local, domain] = parts;
    // Local part must be non-empty and alphanumeric with allowed chars
    if (!local || !/^[a-zA-Z0-9._%+-]+$/.test(local)) continue;
    // Domain must have at least one dot and valid chars
    if (!domain || !domain.includes('.') || !/^[a-zA-Z0-9.-]+$/.test(domain)) continue;
    // TLD must be at least 2 chars
    const tld = domain.split('.').pop();
    if (!tld || tld.length < 2) continue;

    return cleaned;
  }

  return undefined;
}
