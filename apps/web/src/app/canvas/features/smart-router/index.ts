/**
 * Smart Router Feature Module
 *
 * Intelligent routing node that analyzes queries and routes to appropriate agents.
 */

// Types
export type {
  RoutingDecision,
  RoutingContext,
  KeywordEvaluationResult,
  AIRoutingRequest,
  AIRoutingResponse,
  IntegrationType,
  ConnectedAgentInfo,
  KeywordRoutingRule,
} from './types';

// Routing Engine
export {
  buildRouterSystemPrompt,
  evaluateKeywordRules,
  buildAgentInfo,
  parseAIRoutingResponse,
} from './lib/routingEngine';

// Router Executor
export { executeSmartRouter } from './lib/routerExecutor';
