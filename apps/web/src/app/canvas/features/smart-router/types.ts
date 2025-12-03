/**
 * Smart Router Types
 *
 * Type definitions for the Smart Router feature module.
 */

import type { IntegrationType, ConnectedAgentInfo, KeywordRoutingRule } from '../../types';

/**
 * Result of the routing decision
 */
export interface RoutingDecision {
  targetNodeIds: string[];
  reasoning: string;
  matchedKeywords?: string[];
  confidence: number;
}

/**
 * Context provided to the routing engine
 */
export interface RoutingContext {
  query: string;
  connectedAgents: ConnectedAgentInfo[];
  keywordRules: KeywordRoutingRule[];
  routingStrategy: 'ai_only' | 'keyword_then_ai' | 'keyword_only';
}

/**
 * Result of keyword rule evaluation
 */
export interface KeywordEvaluationResult {
  matchedNodeIds: string[];
  matchedKeywords: string[];
  matchedRules: KeywordRoutingRule[];
}

/**
 * AI routing request for the Pro API
 */
export interface AIRoutingRequest {
  query: string;
  connectedAgents: ConnectedAgentInfo[];
  customPrompt?: string;
}

/**
 * AI routing response (parsed from model output)
 */
export interface AIRoutingResponse {
  targetNodeIds: string[];
  reasoning: string;
  confidence: number;
}

export type { IntegrationType, ConnectedAgentInfo, KeywordRoutingRule };
