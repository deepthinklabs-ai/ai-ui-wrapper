/**
 * SSM Agent Prompt Templates
 *
 * Provides structured prompts for different monitoring types.
 * Each prompt is designed to:
 * - Extract relevant information from event streams
 * - Output structured responses for downstream processing
 * - Be efficient for SSM model inference
 *
 * Prompt design principles:
 * - Clear task definition
 * - Structured output format
 * - Minimal token usage (SSMs are efficient but still benefit)
 */

import type { SSMMonitoringType, SSMOutputFormat, SSMAlertSeverity } from '../../../types/ssm';

// ============================================================================
// TYPES
// ============================================================================

export interface PromptContext {
  monitoringType: SSMMonitoringType;
  outputFormat: SSMOutputFormat;
  customPrompt?: string;
  alertThreshold?: number;
  eventContent: string;
  additionalContext?: string;
}

export interface GeneratedPrompt {
  systemPrompt: string;
  userPrompt: string;
}

// ============================================================================
// SYSTEM PROMPTS BY MONITORING TYPE
// ============================================================================

const SYSTEM_PROMPTS: Record<SSMMonitoringType, string> = {
  security_threat: `You are a security monitoring assistant. Analyze incoming events for potential security threats.

Focus on detecting:
- Unauthorized access attempts
- Suspicious login patterns
- Data exfiltration indicators
- Malware signatures
- Policy violations
- Anomalous network activity

Respond with a severity assessment (low/medium/high/critical) and brief explanation.`,

  anomaly_detection: `You are an anomaly detection assistant. Analyze incoming events for unusual patterns or outliers.

Focus on detecting:
- Statistical outliers
- Unusual timing patterns
- Unexpected values or formats
- Behavior deviations from baseline
- Missing expected data
- Duplicate or repeated events

Respond with whether an anomaly was detected and confidence level.`,

  classification: `You are a classification assistant. Categorize incoming events into predefined categories.

Provide:
- Primary category
- Confidence score (0-1)
- Secondary category if applicable
- Brief reasoning

Be consistent in category naming across events.`,

  summarization: `You are a summarization assistant. Create concise summaries of event streams.

Guidelines:
- Extract key information
- Highlight important changes or updates
- Note any action items
- Keep summaries brief but complete
- Preserve critical details`,

  custom: `You are an AI assistant configured for custom monitoring tasks. Follow the specific instructions provided.`,
};

// ============================================================================
// OUTPUT FORMAT INSTRUCTIONS
// ============================================================================

const OUTPUT_FORMAT_INSTRUCTIONS: Record<SSMOutputFormat, string> = {
  alert: `Output your response as a JSON object with this structure:
{
  "detected": true/false,
  "severity": "low" | "medium" | "high" | "critical",
  "title": "Brief alert title",
  "details": "Detailed explanation",
  "confidence": 0.0-1.0,
  "recommended_action": "Optional action to take"
}`,

  summary: `Output your response as plain text prose. Be concise but thorough. Use bullet points for lists. Highlight key findings at the start.`,

  classification: `Output your response as a JSON object with this structure:
{
  "category": "primary category name",
  "confidence": 0.0-1.0,
  "secondary_category": "optional secondary category",
  "reasoning": "brief explanation"
}`,

  raw: `Output your analysis as a JSON object with your findings. Structure it appropriately for the content analyzed.`,
};

// ============================================================================
// PROMPT GENERATION
// ============================================================================

/**
 * Generate a complete prompt for SSM inference
 */
export function generatePrompt(context: PromptContext): GeneratedPrompt {
  const { monitoringType, outputFormat, customPrompt, alertThreshold, eventContent, additionalContext } = context;

  // Build system prompt
  let systemPrompt = SYSTEM_PROMPTS[monitoringType];

  // Add custom prompt if provided (for custom monitoring type)
  if (monitoringType === 'custom' && customPrompt) {
    systemPrompt = `${systemPrompt}\n\nSpecific Instructions:\n${customPrompt}`;
  }

  // Add output format instructions
  systemPrompt = `${systemPrompt}\n\n${OUTPUT_FORMAT_INSTRUCTIONS[outputFormat]}`;

  // Add threshold context for alert output
  if (outputFormat === 'alert' && alertThreshold !== undefined) {
    systemPrompt = `${systemPrompt}\n\nOnly flag as detected if confidence exceeds ${(alertThreshold * 100).toFixed(0)}%.`;
  }

  // Build user prompt
  let userPrompt = `Analyze the following event:\n\n${eventContent}`;

  if (additionalContext) {
    userPrompt = `${userPrompt}\n\nAdditional Context:\n${additionalContext}`;
  }

  return {
    systemPrompt,
    userPrompt,
  };
}

/**
 * Generate a batch analysis prompt for multiple events
 */
export function generateBatchPrompt(
  context: Omit<PromptContext, 'eventContent'> & { events: string[] }
): GeneratedPrompt {
  const { events, ...rest } = context;

  const combinedContent = events
    .map((event, index) => `--- Event ${index + 1} ---\n${event}`)
    .join('\n\n');

  return generatePrompt({
    ...rest,
    eventContent: combinedContent,
    additionalContext: `Analyzing ${events.length} events. Provide analysis for each.`,
  });
}

// ============================================================================
// RESPONSE PARSING
// ============================================================================

export interface ParsedAlertResponse {
  detected: boolean;
  severity: SSMAlertSeverity;
  title: string;
  details: string;
  confidence: number;
  recommendedAction?: string;
}

export interface ParsedClassificationResponse {
  category: string;
  confidence: number;
  secondaryCategory?: string;
  reasoning?: string;
}

/**
 * Parse alert-format response from SSM
 */
export function parseAlertResponse(response: string): ParsedAlertResponse | null {
  try {
    // Try to extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (typeof parsed.detected !== 'boolean') {
      return null;
    }

    // Normalize severity
    const validSeverities: SSMAlertSeverity[] = ['low', 'medium', 'high', 'critical'];
    const severity = validSeverities.includes(parsed.severity?.toLowerCase())
      ? (parsed.severity.toLowerCase() as SSMAlertSeverity)
      : 'low';

    return {
      detected: parsed.detected,
      severity,
      title: String(parsed.title || 'Untitled Alert'),
      details: String(parsed.details || ''),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      recommendedAction: parsed.recommended_action ? String(parsed.recommended_action) : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Parse classification-format response from SSM
 */
export function parseClassificationResponse(response: string): ParsedClassificationResponse | null {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (!parsed.category) {
      return null;
    }

    return {
      category: String(parsed.category),
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0)),
      secondaryCategory: parsed.secondary_category ? String(parsed.secondary_category) : undefined,
      reasoning: parsed.reasoning ? String(parsed.reasoning) : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Extract plain text from summary response
 */
export function parseSummaryResponse(response: string): string {
  // Remove any JSON artifacts if model accidentally included them
  return response
    .replace(/```json[\s\S]*?```/g, '')
    .replace(/```[\s\S]*?```/g, '')
    .trim();
}
