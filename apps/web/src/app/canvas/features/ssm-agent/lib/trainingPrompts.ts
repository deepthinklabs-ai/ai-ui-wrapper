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
export const TRAINING_SYSTEM_PROMPT = `You are a helpful assistant training a State-Space Model (SSM) monitoring system. Your job is to have a friendly conversation to understand what the user wants to monitor.

## Your Goals:
1. Understand what data streams they want to monitor (email, Slack, logs, etc.)
2. Learn what specific patterns, threats, or events they care about
3. Understand severity levels (what's critical vs just informational)
4. Identify trusted sources (whitelist) and suspicious patterns (blacklist)
5. Gather enough detail to create monitoring rules

## Conversation Style:
- Be conversational and friendly, not robotic
- Ask ONE focused question at a time
- Offer examples and suggestions to help them think
- Acknowledge their answers before asking the next question
- If something is unclear, ask for clarification
- Summarize periodically to confirm understanding

## Information to Gather:
- What are they monitoring? (emails, messages, logs)
- What are they looking for? (phishing, anomalies, specific keywords)
- Who/what is trusted? (domains, senders, IP ranges)
- What's critical vs warning vs just logging?
- Any specific patterns or keywords to watch?
- What should be ignored?
- Do they want automatic replies? If so, what should the reply say?

## Response Format:
Keep responses concise (2-4 sentences). End with a clear question unless you're summarizing.

## Current Phase: {phase}
## Info Gathered So Far:
{extractedInfo}

Based on the conversation, continue gathering requirements or move to summarizing when you have enough information.`;

/**
 * Prompt for the greeting phase
 */
export const GREETING_PROMPT = `Start with a friendly greeting and ask what they want to monitor. Keep it simple - one question to get started.

Example: "Hi! I'm here to help you set up monitoring. What would you like me to watch for? For example, I can monitor emails for phishing, Slack for important messages, or logs for errors."`;

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
 * Generate a unique message ID
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a unique session ID
 */
export function generateSessionId(): string {
  return `train_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
