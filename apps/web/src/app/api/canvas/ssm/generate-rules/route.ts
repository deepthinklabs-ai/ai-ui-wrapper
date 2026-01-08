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
import type {
  SSMGenerateRulesRequest,
  SSMGenerateRulesResponse,
  SSMRulesConfig,
  SSMResponseTemplate,
} from '@/app/canvas/types/ssm';

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
    const { description, provider, examples } = body;

    if (!description || description.trim().length < 10) {
      return NextResponse.json({
        success: false,
        error: 'Please provide a more detailed description (at least 10 characters)',
      }, { status: 400 });
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
      const result = await generateWithClaude(prompt);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 500 });
      }
      rules = result.rules!;
      response_templates = result.response_templates!;
    } else if (provider === 'openai') {
      const result = await generateWithOpenAI(prompt);
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

    return NextResponse.json({
      success: true,
      rules,
      response_templates,
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

async function generateWithClaude(prompt: string): Promise<SSMGenerateRulesResponse> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-latest', // Use cheap model for rule generation
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
      const error = await response.text();
      console.error('[SSM Generate Rules] Claude API error:', error);
      return { success: false, error: 'Claude API error' };
    }

    const data = await response.json();
    const content = data.content?.[0]?.text || '';

    return parseGeneratedRules(content);
  } catch (error) {
    console.error('[SSM Generate Rules] Claude error:', error);
    return { success: false, error: 'Failed to call Claude API' };
  }
}

async function generateWithOpenAI(prompt: string): Promise<SSMGenerateRulesResponse> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || ''}`,
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
      const error = await response.text();
      console.error('[SSM Generate Rules] OpenAI API error:', error);
      return { success: false, error: 'OpenAI API error' };
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
