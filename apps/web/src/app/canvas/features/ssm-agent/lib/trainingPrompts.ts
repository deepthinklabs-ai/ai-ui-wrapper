/**
 * SSM Training Prompts
 *
 * System prompts and helpers for the conversational training interface.
 * These guide the LLM to gather monitoring requirements through dialogue.
 */

import type { SSMTrainingPhase, SSMExtractedInfo, SSMTrainingMessage } from '../types/training';

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

/**
 * Main system prompt for training conversations
 */
export const TRAINING_SYSTEM_PROMPT = `You are a helpful assistant training a monitoring system. Your job is to quickly understand what the user wants and propose actionable rules.

## Your Approach:
When the user describes what they want to monitor, IMMEDIATELY propose draft rules based on their request. Don't ask lots of clarifying questions first - propose something concrete they can react to.

## Response Format:
After the user's FIRST message describing what they want, respond with:

1. A brief acknowledgment (1 sentence)
2. **Proposed Rules** - Show a draft of what you'll configure:
   - What triggers an alert
   - Severity level (info/warning/critical)
   - Any automatic actions (like auto-reply)
3. **Optional Questions** (if any) - List 1-2 optional questions they can answer if they want to refine the rules. Make it clear these are optional.

Example response format:
"Got it! Here's what I'll set up:

**Draft Rules:**
- Monitor emails from [specific sender]
- Trigger: When email is received
- Action: Send automatic reply "[their message]"
- Severity: Info

**Optional (answer if you want to customize):**
- Should I also log these emails for reporting?
- Any senders to exclude from auto-reply?

If this looks good, just say 'looks good' and I'll generate the rules. Or tell me what to change."

## Key Principles:
- PROPOSE first, then refine based on feedback
- Keep responses SHORT and actionable
- Don't ask unnecessary questions - use sensible defaults
- User can always add more details if they want

## Current Phase: {phase}
## Info Gathered So Far:
{extractedInfo}`;

/**
 * Prompt for the greeting phase
 */
export const GREETING_PROMPT = `Start with a brief, friendly greeting. Ask what they want to monitor.

Example: "Hi! Tell me what you want to monitor and I'll propose some rules. For example: 'Watch for emails from X and auto-reply with Y' or 'Alert me when emails contain urgent requests'."`;

/**
 * Prompt for summarizing gathered information
 */
export const SUMMARY_PROMPT = `Summarize what you've learned in a clear, bulleted format. Ask the user to confirm or correct anything.

Format:
"Based on our conversation, here's what I'll monitor for:

📧 **Data Source:** [what they're monitoring]

🎯 **Looking For:**
- [threat/pattern 1]
- [threat/pattern 2]

✅ **Trusted (will ignore):**
- [trusted source 1]

⚠️ **Alert Levels:**
- Critical: [what triggers critical]
- Warning: [what triggers warning]
- Info: [what gets logged]

Does this look right? Say 'yes' to confirm, or let me know what to change."`;

/**
 * Prompt for generating rules from conversation
 */
export const RULES_GENERATION_PROMPT = `Based on the training conversation below, generate monitoring rules.

CONVERSATION:
{conversation}

EXTRACTED INFO:
{extractedInfo}

Generate a JSON response with:
1. A clear monitoring_description (1-2 sentences summarizing what to monitor)
2. The logic mode: "all" if ALL conditions must match (AND), "any" if ANY condition triggers (OR)
3. Keyword rules for important terms
4. Pattern rules (regex) for complex patterns
5. Condition rules for field-based matching
6. Response templates for each severity
7. Auto-reply configuration (if user mentioned wanting automatic replies)

IMPORTANT - Logic Mode Selection:
- Use "all" (AND logic) when the user describes COMPOUND requirements like:
  - "emails from X AND containing Y"
  - "from address X with subject containing Y"
  - "messages from sender X that mention keyword Y"
- Use "any" (OR logic) when the user wants to catch ANY of several patterns:
  - "emails containing X OR Y"
  - "watch for phishing OR spam"
  - "alert on any suspicious activity"

IMPORTANT - Condition Fields for Email:
- Use field "from" for sender email address checks
- Use field "subject" for subject line checks
- Use field "content" for body text checks

IMPORTANT - Auto-Reply Configuration:
If the user mentioned wanting to send automatic replies when matches occur:
- Set auto_reply.enabled to true
- Configure the template with appropriate subject and body
- Use placeholders like {sender}, {subject}, {matched_rules}, {severity}
- If user didn't mention auto-reply, set auto_reply.enabled to false

OUTPUT FORMAT (JSON only, no markdown):
{
  "monitoring_description": "...",
  "rules": {
    "logic": "all" or "any",
    "keywords": [...],
    "patterns": [...],
    "conditions": [...]
  },
  "response_templates": [...],
  "auto_reply": {
    "enabled": true/false,
    "template": {
      "subject": "Re: {subject}",
      "body": "Your reply message here...",
      "signature": "Optional signature",
      "includeOriginal": true/false
    },
    "conditions": {
      "severities": ["info", "warning", "critical"],
      "excludeSenders": ["noreply@", "automated@"]
    },
    "rateLimit": {
      "maxRepliesPerSender": 1,
      "windowMinutes": 60
    }
  }
}`;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Build the system prompt for a given phase and extracted info
 */
export function buildSystemPrompt(
  phase: SSMTrainingPhase,
  extractedInfo: SSMExtractedInfo
): string {
  const infoSummary = formatExtractedInfo(extractedInfo);

  let prompt = TRAINING_SYSTEM_PROMPT
    .replace('{phase}', phase)
    .replace('{extractedInfo}', infoSummary || 'None yet');

  // Add phase-specific guidance
  if (phase === 'greeting') {
    prompt += '\n\n' + GREETING_PROMPT;
  } else if (phase === 'summarizing' || phase === 'confirming') {
    prompt += '\n\n' + SUMMARY_PROMPT;
  }

  return prompt;
}

/**
 * Format extracted info for display in prompts
 */
export function formatExtractedInfo(info: SSMExtractedInfo): string {
  const lines: string[] = [];

  if (info.monitoringGoal) {
    lines.push(`Goal: ${info.monitoringGoal}`);
  }
  if (info.specificThreats?.length) {
    lines.push(`Threats: ${info.specificThreats.join(', ')}`);
  }
  if (info.trustedDomains?.length) {
    lines.push(`Trusted domains: ${info.trustedDomains.join(', ')}`);
  }
  if (info.trustedSenders?.length) {
    lines.push(`Trusted senders: ${info.trustedSenders.join(', ')}`);
  }
  if (info.criticalPatterns?.length) {
    lines.push(`Critical patterns: ${info.criticalPatterns.join(', ')}`);
  }
  if (info.warningPatterns?.length) {
    lines.push(`Warning patterns: ${info.warningPatterns.join(', ')}`);
  }

  return lines.join('\n');
}

/**
 * Build conversation history for API calls
 */
export function buildConversationHistory(
  messages: SSMTrainingMessage[]
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
}

/**
 * Determine next phase based on conversation progress
 */
export function determineNextPhase(
  currentPhase: SSMTrainingPhase,
  messageCount: number,
  extractedInfo: SSMExtractedInfo,
  userMessage: string
): SSMTrainingPhase {
  const lowerMessage = userMessage.toLowerCase();

  // Check for confirmation to finalize
  if (currentPhase === 'confirming') {
    if (lowerMessage.includes('yes') || lowerMessage.includes('confirm') || lowerMessage.includes('looks good')) {
      return 'generating';
    }
    // User wants changes, go back to gathering
    return 'gathering';
  }

  // Check for summarizing trigger
  if (currentPhase === 'summarizing') {
    return 'confirming';
  }

  // After greeting, move to gathering
  if (currentPhase === 'greeting') {
    return 'gathering';
  }

  // Check if we have enough info to summarize
  const hasEnoughInfo =
    extractedInfo.monitoringGoal &&
    (extractedInfo.specificThreats?.length || extractedInfo.criticalPatterns?.length || extractedInfo.warningPatterns?.length);

  // After several exchanges with good info, prompt to summarize
  if (currentPhase === 'gathering' && messageCount >= 6 && hasEnoughInfo) {
    return 'summarizing';
  }

  // Check for user asking to finish
  if (lowerMessage.includes('done') || lowerMessage.includes('finish') || lowerMessage.includes('that\'s all')) {
    return hasEnoughInfo ? 'summarizing' : 'clarifying';
  }

  return currentPhase;
}

/**
 * Generate a unique message ID using cryptographically secure randomness
 */
export function generateMessageId(): string {
  // Use crypto.randomUUID() for secure random ID generation
  const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  return `msg_${uuid}`;
}

/**
 * Generate a unique session ID using cryptographically secure randomness
 */
export function generateSessionId(): string {
  // Use crypto.randomUUID() for secure random ID generation
  const uuid = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  return `train_${uuid}`;
}
