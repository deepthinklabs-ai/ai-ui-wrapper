/**
 * POST /api/canvas/ssm/generate-rules
 *
 * Generates monitoring rules from a plain English description.
 * Uses LLM (Claude/OpenAI) to create:
 * - Keyword rules
 * - Pattern rules (regex)
 * - Condition rules
 * - Response templates
 *
 * This is the ONLY endpoint that uses LLM for SSM.
 * Runtime monitoring uses pure pattern matching ($0 cost).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type {
  SSMGenerateRulesRequest,
  SSMGenerateRulesResponse,
  SSMRulesConfig,
  SSMResponseTemplate,
} from '@/app/canvas/types/ssm';
import type { SSMAutoReplyConfig } from '@/app/canvas/features/ssm-agent/features/auto-reply/types';
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
// PROMPT TEMPLATE
// ============================================================================

const RULES_GENERATION_PROMPT = `You are an expert at creating monitoring rules for security and event detection systems.

Given the user's description of what they want to monitor for, generate:

1. **Keywords** - Important words/phrases that indicate the described scenario
2. **Patterns** - Regex patterns for complex matching
3. **Conditions** - Field-based rules (sender, subject, amount, etc.)
4. **Response Templates** - Pre-defined messages for each severity level

OUTPUT FORMAT (JSON only, no markdown):
{
  "rules": {
    "keywords": [
      {
        "id": "kw_1",
        "keyword": "example keyword",
        "caseSensitive": false,
        "severity": "warning",
        "enabled": true
      }
    ],
    "patterns": [
      {
        "id": "pat_1",
        "name": "Pattern Name",
        "pattern": "regex pattern here",
        "description": "What this pattern matches",
        "severity": "critical",
        "enabled": true
      }
    ],
    "conditions": [
      {
        "id": "cond_1",
        "field": "sender",
        "operator": "contains",
        "value": "example.com",
        "severity": "info",
        "enabled": true
      }
    ]
  },
  "response_templates": [
    {
      "severity": "info",
      "title": "Informational: {matched_rule}",
      "message": "Event logged: {content_preview}",
      "action": "log"
    },
    {
      "severity": "warning",
      "title": "Warning: {matched_rule}",
      "message": "Suspicious activity detected: {content_preview}. Matched: {matched_keywords}",
      "action": "alert"
    },
    {
      "severity": "critical",
      "title": "CRITICAL: {matched_rule}",
      "message": "Immediate attention required! {content_preview}. This matched critical rules: {matched_keywords}",
      "action": "forward_to_ai"
    }
  ]
}

SEVERITY GUIDELINES:
- "info" - Interesting but not concerning (log only)
- "warning" - Potentially suspicious, needs attention (alert user)
- "critical" - Likely threat/issue, may need AI analysis (forward to AI Agent)

AVAILABLE TEMPLATE PLACEHOLDERS:
- {sender} - Event sender/source
- {subject} - Event subject/title
- {content_preview} - First 100 chars of content
- {matched_rule} - Name of rule that matched
- {matched_keywords} - List of keywords that matched
- {timestamp} - When the event occurred

USER'S MONITORING DESCRIPTION:
`;

// ============================================================================
// HANDLER
// ============================================================================

export async function POST(request: NextRequest): Promise<NextResponse<SSMGenerateRulesResponse>> {
  try {
    const body: SSMGenerateRulesRequest = await request.json();
    const { description, provider, userId, examples } = body;

    if (!description || description.trim().length < 10) {
      return NextResponse.json({
        success: false,
        error: 'Please provide a more detailed description (at least 10 characters)',
      }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({
        success: false,
        error: 'User ID is required',
      }, { status: 400 });
    }

    // Verify user has Pro tier (SSM is a Pro feature)
    const supabase = getSupabaseAdmin();
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', userId)
      .single();

    if (!profile || profile.tier !== 'pro') {
      return NextResponse.json({
        success: false,
        error: 'Polling Monitor requires Pro subscription',
      }, { status: 403 });
    }

    // Get user's API key for the selected provider
    const providerKey = provider === 'claude' ? 'claude' : 'openai';
    const apiKey = await getProviderKey(userId, providerKey);
    if (!apiKey) {
      const providerName = provider === 'claude' ? 'Claude' : 'OpenAI';
      return NextResponse.json({
        success: false,
        error: `Please configure your ${providerName} API key in Settings to generate rules.`,
      }, { status: 403 });
    }

    // Build the prompt
    let prompt = RULES_GENERATION_PROMPT + description;

    if (examples && examples.length > 0) {
      prompt += '\n\nEXAMPLE EVENTS TO CONSIDER:\n';
      examples.forEach((ex, i) => {
        prompt += `${i + 1}. ${ex}\n`;
      });
    }

    // Call the appropriate AI provider
    let rules: SSMRulesConfig;
    let response_templates: SSMResponseTemplate[];

    if (provider === 'claude') {
      const result = await generateWithClaude(prompt, apiKey);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 500 });
      }
      rules = result.rules!;
      response_templates = result.response_templates!;
    } else if (provider === 'openai') {
      const result = await generateWithOpenAI(prompt, apiKey);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 500 });
      }
      rules = result.rules!;
      response_templates = result.response_templates!;
    } else {
      return NextResponse.json({
        success: false,
        error: 'Invalid provider. Use "claude" or "openai"',
      }, { status: 400 });
    }

    // Extract notification recipient email from description (for calendar events)
    // Looks for patterns like "send email to user@example.com" or "email user@example.com"
    const notification_recipient = extractNotificationRecipient(description);

    return NextResponse.json({
      success: true,
      rules,
      response_templates,
      notification_recipient,
    });

  } catch (error) {
    console.error('[SSM Generate Rules] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate rules',
    }, { status: 500 });
  }
}

// ============================================================================
// AI PROVIDER FUNCTIONS
// ============================================================================

async function generateWithClaude(prompt: string, apiKey: string): Promise<SSMGenerateRulesResponse> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307', // Use cheap model for rule generation
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SSM Generate Rules] Claude API error:', response.status, errorText);
      return { success: false, error: `Claude API error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    return parseGeneratedRules(content);
  } catch (error) {
    console.error('[SSM Generate Rules] Claude error:', error);
    return { success: false, error: 'Failed to call Claude API' };
  }
}

async function generateWithOpenAI(prompt: string, apiKey: string): Promise<SSMGenerateRulesResponse> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Use cheap model for rule generation
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[SSM Generate Rules] OpenAI API error:', response.status, errorText);
      return { success: false, error: `OpenAI API error: ${response.status}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return parseGeneratedRules(content);
  } catch (error) {
    console.error('[SSM Generate Rules] OpenAI error:', error);
    return { success: false, error: 'Failed to call OpenAI API' };
  }
}

// ============================================================================
// PARSING
// ============================================================================

function parseGeneratedRules(content: string): SSMGenerateRulesResponse {
  try {
    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    // Try to find JSON object
    const objectMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!objectMatch) {
      return { success: false, error: 'No valid JSON found in response' };
    }

    const parsed = JSON.parse(objectMatch[0]);

    // Validate structure
    if (!parsed.rules || !parsed.response_templates) {
      return { success: false, error: 'Invalid response structure' };
    }

    // Ensure rules have required structure
    const rules: SSMRulesConfig = {
      keywords: Array.isArray(parsed.rules.keywords) ? parsed.rules.keywords : [],
      patterns: Array.isArray(parsed.rules.patterns) ? parsed.rules.patterns : [],
      conditions: Array.isArray(parsed.rules.conditions) ? parsed.rules.conditions : [],
    };

    // Ensure response templates have required structure
    const response_templates: SSMResponseTemplate[] = Array.isArray(parsed.response_templates)
      ? parsed.response_templates
      : getDefaultTemplates();

    return {
      success: true,
      rules,
      response_templates,
    };
  } catch (error) {
    console.error('[SSM Generate Rules] Parse error:', error);
    return { success: false, error: 'Failed to parse generated rules' };
  }
}

function getDefaultTemplates(): SSMResponseTemplate[] {
  return [
    {
      severity: 'info',
      title: 'Info: {matched_rule}',
      message: 'Event logged: {content_preview}',
      action: 'log',
    },
    {
      severity: 'warning',
      title: 'Warning: {matched_rule}',
      message: 'Suspicious activity: {content_preview}',
      action: 'alert',
    },
    {
      severity: 'critical',
      title: 'CRITICAL: {matched_rule}',
      message: 'Immediate attention required: {content_preview}',
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
 * - "send notification to user@example.com"
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

    console.log(`[SSM Generate Rules] Extracted notification recipient: ${cleaned}`);
    return cleaned;
  }

  return undefined;
}
