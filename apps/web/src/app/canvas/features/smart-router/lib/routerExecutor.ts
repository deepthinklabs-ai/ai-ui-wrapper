/**
 * Smart Router - Router Executor
 *
 * Orchestrates the routing logic: keyword detection + AI decision.
 */

import type { SmartRouterNodeConfig, ConnectedAgentInfo } from '../../../types';
import type { RoutingDecision } from '../types';
import {
  buildRouterSystemPrompt,
  evaluateKeywordRules,
  parseAIRoutingResponse,
} from './routingEngine';
import { INTERNAL_SERVICE_AUTH_HEADER } from '@/lib/serverAuth';
import { getVercelBypassHeaders } from '@/lib/internalApiUrl';

/**
 * Execute Smart Router logic
 *
 * Flow:
 * 1. If keyword_only or keyword_then_ai: evaluate keyword rules first
 * 2. If ai_only or keyword_then_ai: call AI for routing decision
 * 3. Combine results based on strategy
 * 4. Return final routing decision
 */
export async function executeSmartRouter(
  config: SmartRouterNodeConfig,
  query: string,
  connectedAgents: ConnectedAgentInfo[],
  userId: string,
  internalBaseUrl: string
): Promise<RoutingDecision> {
  console.log(`[Smart Router] Executing with strategy: ${config.routing_strategy}`);
  console.log(`[Smart Router] Query: "${query.substring(0, 100)}..."`);
  console.log(`[Smart Router] Connected agents: ${connectedAgents.length}`);

  // Handle no connected agents
  if (connectedAgents.length === 0) {
    return {
      targetNodeIds: [],
      reasoning: 'No agents connected to Smart Router',
      confidence: 0,
    };
  }

  // Step 1: Keyword-based routing (if applicable)
  let keywordMatches: string[] = [];
  let matchedKeywords: string[] = [];

  if (config.routing_strategy !== 'ai_only') {
    const keywordResult = evaluateKeywordRules(
      query,
      config.keyword_rules,
      connectedAgents
    );

    keywordMatches = keywordResult.matchedNodeIds;
    matchedKeywords = keywordResult.matchedKeywords;

    console.log(`[Smart Router] Keyword matches: ${keywordMatches.length} agents`);
    console.log(`[Smart Router] Matched keywords: ${matchedKeywords.join(', ')}`);

    // If keyword_only strategy and we have matches, return immediately
    if (config.routing_strategy === 'keyword_only' && keywordMatches.length > 0) {
      return {
        targetNodeIds: keywordMatches.slice(0, config.max_parallel_agents || 5),
        reasoning: `Matched keywords: ${matchedKeywords.join(', ')}`,
        matchedKeywords,
        confidence: 0.8,
      };
    }
  }

  // Step 2: AI-based routing
  if (config.routing_strategy === 'ai_only' || config.routing_strategy === 'keyword_then_ai') {
    console.log(`[Smart Router] Calling AI for routing decision`);

    const systemPrompt = buildRouterSystemPrompt(
      connectedAgents,
      config.ai_routing_prompt
    );

    // Determine API endpoint based on model provider
    const apiEndpoint =
      config.model_provider === 'openai'
        ? '/api/pro/openai'
        : config.model_provider === 'claude'
        ? '/api/pro/claude'
        : '/api/pro/grok';

    try {
      // Build headers with internal service auth and Vercel bypass for server-to-server calls
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...getVercelBypassHeaders(), // Bypass Vercel Deployment Protection
      };
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceKey) {
        headers[INTERNAL_SERVICE_AUTH_HEADER] = serviceKey;
      }

      // Debug: Log the URL and headers being used
      const fullUrl = new URL(apiEndpoint, internalBaseUrl).toString();
      console.log(`[Smart Router] Calling AI API: ${fullUrl}`);
      console.log(`[Smart Router] Has bypass header: ${!!headers['x-vercel-protection-bypass']}`);
      console.log(`[Smart Router] Has service auth: ${!!headers[INTERNAL_SERVICE_AUTH_HEADER]}`);

      const response = await fetch(fullUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId,
          messages: [{ role: 'user', content: query }],
          model: config.model_name,
          systemPrompt,
          temperature: config.temperature || 0.3,
          maxTokens: 500,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Smart Router] AI API error: ${response.status} - ${errorText}`);
        throw new Error(`AI routing failed: ${response.status}`);
      }

      const data = await response.json();
      const aiContent = data.content || data.message || '';

      console.log(`[Smart Router] AI response: ${aiContent.substring(0, 200)}...`);

      const aiDecision = parseAIRoutingResponse(aiContent);

      if (!aiDecision) {
        console.error(`[Smart Router] Failed to parse AI decision`);
        // Fall back to keyword matches if available
        if (keywordMatches.length > 0) {
          return {
            targetNodeIds: keywordMatches.slice(0, config.max_parallel_agents || 5),
            reasoning: `AI parsing failed, using keyword matches: ${matchedKeywords.join(', ')}`,
            matchedKeywords,
            confidence: 0.6,
          };
        }
        // Use fallback agent if configured
        if (config.fallback_agent_id) {
          return {
            targetNodeIds: [config.fallback_agent_id],
            reasoning: 'AI routing failed, using fallback agent',
            confidence: 0.3,
          };
        }
        return {
          targetNodeIds: [],
          reasoning: 'AI routing failed and no fallback available',
          confidence: 0,
        };
      }

      // Step 3: Combine keyword and AI results if keyword_then_ai strategy
      if (config.routing_strategy === 'keyword_then_ai') {
        // Merge keyword matches with AI decision (keywords take priority)
        const combinedTargets = new Set([...keywordMatches, ...aiDecision.targetNodeIds]);
        const finalTargets = Array.from(combinedTargets).slice(
          0,
          config.max_parallel_agents || 5
        );

        // Validate that all targets are actually connected agents
        const validTargets = finalTargets.filter(id =>
          connectedAgents.some(a => a.nodeId === id)
        );

        return {
          targetNodeIds: validTargets,
          reasoning: aiDecision.reasoning,
          matchedKeywords: matchedKeywords.length > 0 ? matchedKeywords : undefined,
          confidence: aiDecision.confidence,
        };
      }

      // AI-only: just validate and return AI decision
      const validTargets = aiDecision.targetNodeIds.filter(id =>
        connectedAgents.some(a => a.nodeId === id)
      );

      return {
        targetNodeIds: validTargets.slice(0, config.max_parallel_agents || 5),
        reasoning: aiDecision.reasoning,
        confidence: aiDecision.confidence,
      };
    } catch (error) {
      console.error(`[Smart Router] AI routing error:`, error);

      // Fall back to keyword matches if available
      if (keywordMatches.length > 0) {
        return {
          targetNodeIds: keywordMatches.slice(0, config.max_parallel_agents || 5),
          reasoning: `AI error, using keyword matches: ${matchedKeywords.join(', ')}`,
          matchedKeywords,
          confidence: 0.5,
        };
      }

      // Use fallback agent if configured
      if (config.fallback_agent_id) {
        return {
          targetNodeIds: [config.fallback_agent_id],
          reasoning: 'AI routing error, using fallback agent',
          confidence: 0.3,
        };
      }

      return {
        targetNodeIds: [],
        reasoning: `AI routing error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        confidence: 0,
      };
    }
  }

  // keyword_only with no matches
  if (config.fallback_agent_id) {
    return {
      targetNodeIds: [config.fallback_agent_id],
      reasoning: 'No keyword matches, using fallback agent',
      confidence: 0.3,
    };
  }

  return {
    targetNodeIds: [],
    reasoning: 'No routing match found',
    confidence: 0,
  };
}
