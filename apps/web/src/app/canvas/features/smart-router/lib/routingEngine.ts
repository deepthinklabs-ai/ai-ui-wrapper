/**
 * Smart Router - Routing Engine
 *
 * Core logic for building routing prompts and evaluating keyword rules.
 */

import type {
  ConnectedAgentInfo,
  KeywordRoutingRule,
  KeywordEvaluationResult,
  IntegrationType,
} from '../types';

/**
 * Build system prompt for the Smart Router AI
 * Dynamically includes connected agent capabilities
 */
export function buildRouterSystemPrompt(
  connectedAgents: ConnectedAgentInfo[],
  customPrompt?: string
): string {
  let prompt = `You are a Smart Router that analyzes user queries and determines which AI Agent(s) should handle them.

Your job is to:
1. Understand the user's intent and what actions they want performed
2. Match the intent to the capabilities of connected agents
3. Decide if one or multiple agents are needed (e.g., "send email AND create calendar event" needs two agents)
4. Return a JSON decision

## Connected Agents and Their Capabilities:
`;

  if (connectedAgents.length === 0) {
    prompt += `\nNo agents are currently connected. Return an empty targetNodeIds array.\n`;
  } else {
    connectedAgents.forEach((agent, index) => {
      const integrationsList = agent.integrations.length > 0
        ? agent.integrations.join(', ')
        : 'General AI (no specific integrations)';

      prompt += `
### Agent ${index + 1}: "${agent.name}" (ID: ${agent.nodeId})
- Integrations: ${integrationsList}
- Capabilities:
${agent.capabilities.map(c => `  - ${c}`).join('\n')}
`;
    });
  }

  prompt += `
## Response Format
You MUST respond with valid JSON only, no other text. Format:
{
  "targetNodeIds": ["node-id-1", "node-id-2"],
  "reasoning": "Brief explanation of why these agents were selected",
  "confidence": 0.95
}

## Rules:
- If the query requires multiple integrations (e.g., email AND calendar), include multiple agent IDs
- If no agent matches, return an empty targetNodeIds array
- Only include agents whose capabilities are relevant to the query
- Confidence should be 0.0-1.0 based on how well the query matches available capabilities

${customPrompt || ''}`;

  return prompt;
}

/**
 * Evaluate keyword-based routing rules
 * Fast, deterministic routing based on pattern matching
 */
export function evaluateKeywordRules(
  query: string,
  rules: KeywordRoutingRule[],
  agents: ConnectedAgentInfo[]
): KeywordEvaluationResult {
  const queryLower = query.toLowerCase();
  const matchedNodeIds: Set<string> = new Set();
  const matchedKeywords: Set<string> = new Set();
  const matchedRules: KeywordRoutingRule[] = [];

  // Sort rules by priority (higher first)
  const sortedRules = [...rules]
    .filter(r => r.enabled)
    .sort((a, b) => b.priority - a.priority);

  for (const rule of sortedRules) {
    // Check if any keywords match
    const keywordsFound = rule.keywords.filter(kw =>
      queryLower.includes(kw.toLowerCase())
    );

    if (keywordsFound.length > 0) {
      // Add matched keywords
      keywordsFound.forEach(kw => matchedKeywords.add(kw));

      // Find agents with matching integration
      if (rule.integration_type) {
        const matchingAgents = agents.filter(a =>
          a.integrations.includes(rule.integration_type as IntegrationType)
        );

        if (matchingAgents.length > 0) {
          matchingAgents.forEach(a => matchedNodeIds.add(a.nodeId));
          matchedRules.push(rule);
        }
      } else {
        // Rule without integration_type - matches all agents
        agents.forEach(a => matchedNodeIds.add(a.nodeId));
        matchedRules.push(rule);
      }
    }
  }

  return {
    matchedNodeIds: Array.from(matchedNodeIds),
    matchedKeywords: Array.from(matchedKeywords),
    matchedRules,
  };
}

/**
 * Build ConnectedAgentInfo from a Genesis Bot node config
 */
export function buildAgentInfo(
  nodeId: string,
  nodeName: string,
  config: any
): ConnectedAgentInfo {
  const integrations: IntegrationType[] = [];
  const capabilities: string[] = [];

  // Check Gmail integration
  if (config.gmail?.enabled) {
    integrations.push('gmail');
    const gmailCaps: string[] = [];
    if (config.gmail.permissions?.canSearch) gmailCaps.push('search emails');
    if (config.gmail.permissions?.canRead) gmailCaps.push('read emails');
    if (config.gmail.permissions?.canSend) gmailCaps.push('send emails');
    if (config.gmail.permissions?.canManageDrafts) gmailCaps.push('manage drafts');
    capabilities.push(`Gmail: ${gmailCaps.join(', ') || 'basic access'}`);
  }

  // Check Calendar integration
  if (config.calendar?.enabled) {
    integrations.push('calendar');
    const calCaps: string[] = [];
    if (config.calendar.permissions?.canRead) calCaps.push('view events');
    if (config.calendar.permissions?.canCreate) calCaps.push('create events');
    if (config.calendar.permissions?.canUpdate) calCaps.push('update events');
    if (config.calendar.permissions?.canDelete) calCaps.push('delete events');
    capabilities.push(`Calendar: ${calCaps.join(', ') || 'basic access'}`);
  }

  // Check Sheets integration
  if (config.sheets?.enabled) {
    integrations.push('sheets');
    const sheetsCaps: string[] = [];
    if (config.sheets.permissions?.canRead) sheetsCaps.push('read spreadsheets');
    if (config.sheets.permissions?.canWrite) sheetsCaps.push('write to spreadsheets');
    if (config.sheets.permissions?.canCreate) sheetsCaps.push('create spreadsheets');
    capabilities.push(`Sheets: ${sheetsCaps.join(', ') || 'basic access'}`);
  }

  // Check Docs integration
  if (config.docs?.enabled) {
    integrations.push('docs');
    const docsCaps: string[] = [];
    if (config.docs.permissions?.canRead) docsCaps.push('read documents');
    if (config.docs.permissions?.canWrite) docsCaps.push('write documents');
    if (config.docs.permissions?.canCreate) docsCaps.push('create documents');
    capabilities.push(`Docs: ${docsCaps.join(', ') || 'basic access'}`);
  }

  // Check Slack integration
  if (config.slack?.enabled) {
    integrations.push('slack');
    const slackCaps: string[] = [];
    if (config.slack.permissions?.canSend) slackCaps.push('send messages');
    if (config.slack.permissions?.canRead) slackCaps.push('read messages');
    if (config.slack.permissions?.canListChannels) slackCaps.push('list channels');
    capabilities.push(`Slack: ${slackCaps.join(', ') || 'basic access'}`);
  }

  // Add general capabilities from system prompt if no integrations
  if (capabilities.length === 0) {
    capabilities.push('General AI assistant');
    if (config.web_search_enabled) {
      capabilities.push('Web search');
    }
  }

  return {
    nodeId,
    name: nodeName,
    integrations,
    capabilities,
  };
}

/**
 * Parse AI routing response from model output
 */
export function parseAIRoutingResponse(content: string): {
  targetNodeIds: string[];
  reasoning: string;
  confidence: number;
} | null {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[Smart Router] No JSON found in AI response');
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      targetNodeIds: Array.isArray(parsed.targetNodeIds) ? parsed.targetNodeIds : [],
      reasoning: parsed.reasoning || 'No reasoning provided',
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    };
  } catch (error) {
    console.error('[Smart Router] Failed to parse AI routing response:', error);
    return null;
  }
}
