/**
 * Response Compiler Types
 *
 * Type definitions for the Response Compiler feature module.
 */

/**
 * Response from an individual agent
 */
export interface AgentResponse {
  nodeId: string;
  agentName: string;
  response: string;
  timestamp: string;
  success: boolean;
  error?: string;
  duration_ms?: number;
}

/**
 * Compilation result
 */
export interface CompilationResult {
  compiledResponse: string;
  sourceResponses: AgentResponse[];
  strategy: 'ai_summarize' | 'concatenate' | 'prioritized';
  timestamp: string;
  duration_ms: number;
}

/**
 * Compilation context
 */
export interface CompilationContext {
  originalQuery: string;
  agentResponses: AgentResponse[];
  strategy: 'ai_summarize' | 'concatenate' | 'prioritized';
  includeSourceAttribution: boolean;
  outputFormat: 'prose' | 'bullet_points' | 'structured';
}
