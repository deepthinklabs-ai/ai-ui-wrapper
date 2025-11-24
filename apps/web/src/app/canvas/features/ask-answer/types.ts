/**
 * Ask/Answer Feature Types
 *
 * Type definitions for inter-node question/answer communication.
 * Properly segmented to avoid contaminating core Canvas types.
 */

import type { NodeId, EdgeId, CanvasId } from '../../types';

// ============================================================================
// EDGE METADATA EXTENSION
// ============================================================================

/**
 * Ask/Answer metadata stored in edge.metadata
 */
export interface AskAnswerEdgeMetadata {
  askAnswerEnabled: boolean;
  lastQuery?: {
    id: string;
    query: string;
    answer?: string;
    timestamp: string;
    status: 'sending' | 'processing' | 'answered' | 'error';
    error?: string;
  };
  queryHistory?: QueryHistoryEntry[];
}

export interface QueryHistoryEntry {
  id: string;
  query: string;
  answer: string;
  timestamp: string;
  duration_ms: number;
}

// ============================================================================
// NODE CONFIG EXTENSION
// ============================================================================

/**
 * Ask/Answer configuration stored in Genesis Bot node config
 */
export interface AskAnswerNodeConfig {
  // Outgoing queries (Node A → Node B)
  outgoingQueries: Array<{
    id: string;
    toNodeId: NodeId;
    edgeId: EdgeId;
    query: string;
    answer?: string;
    timestamp: string;
    status: 'pending' | 'answered' | 'error';
  }>;

  // Incoming queries (Node B receiving from Node A)
  incomingQueries: Array<{
    id: string;
    fromNodeId: NodeId;
    edgeId: EdgeId;
    query: string;
    timestamp: string;
    processed: boolean;
  }>;

  // Last answer generated (for Node B)
  lastAnswer?: {
    query: string;
    answer: string;
    toNodeId: NodeId;
    timestamp: string;
  };
}

// ============================================================================
// API TYPES
// ============================================================================

/**
 * Request to send a query from Node A to Node B
 */
export interface AskAnswerQueryRequest {
  canvasId: CanvasId;
  fromNodeId: NodeId; // Node A
  toNodeId: NodeId;   // Node B
  edgeId: EdgeId;
  query: string;
}

/**
 * Response from query API
 */
export interface AskAnswerQueryResponse {
  success: boolean;
  queryId: string;
  answer?: string;
  error?: string;
  timestamp: string;
  duration_ms?: number;
}

/**
 * Real-time update message (future: websocket)
 */
export interface AskAnswerStatusUpdate {
  queryId: string;
  status: 'processing' | 'answered' | 'error';
  answer?: string;
  error?: string;
  timestamp: string;
}

// ============================================================================
// HOOK TYPES
// ============================================================================

/**
 * Return type for useAskAnswer hook
 */
export interface UseAskAnswerResult {
  // State
  isEnabled: (edgeId: EdgeId) => boolean;
  canAskQuestion: (fromNodeId: NodeId, toNodeId: NodeId) => boolean;
  getPendingAnswer: (fromNodeId: NodeId, edgeId: EdgeId) => PendingAnswer | null;
  getQueryHistory: (edgeId: EdgeId) => QueryHistoryEntry[];

  // Actions
  enableAskAnswer: (edgeId: EdgeId) => Promise<boolean>;
  disableAskAnswer: (edgeId: EdgeId) => Promise<boolean>;
  sendQuery: (params: AskAnswerQueryParams) => Promise<AskAnswerQueryResponse>;
  clearAnswer: (fromNodeId: NodeId, queryId: string) => Promise<boolean>;
  clearHistory: (edgeId: EdgeId) => Promise<boolean>;

  // Loading states
  isSendingQuery: boolean;
  isProcessingQuery: boolean;
}

/**
 * Parameters for sending a query
 */
export interface AskAnswerQueryParams {
  fromNodeId: NodeId;
  toNodeId: NodeId;
  edgeId: EdgeId;
  query: string;
}

/**
 * Pending answer waiting for user review
 */
export interface PendingAnswer {
  queryId: string;
  query: string;
  answer: string;
  timestamp: string;
  fromNodeName: string;
  toNodeName: string;
}

// ============================================================================
// COMPONENT PROPS
// ============================================================================

/**
 * Props for AskAnswerToggle component
 */
export interface AskAnswerToggleProps {
  edgeId: EdgeId;
  fromNodeId: NodeId;
  toNodeId: NodeId;
  enabled: boolean;
  onToggle: (enabled: boolean) => Promise<void>;
  disabled?: boolean;
}

/**
 * Props for QueryInput component
 */
export interface QueryInputProps {
  fromNodeId: NodeId;
  toNodeId: NodeId;
  edgeId: EdgeId;
  onSendQuery: (query: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Props for QueryReviewPanel component
 */
export interface QueryReviewPanelProps {
  pendingAnswer: PendingAnswer;
  onClear: () => void;
  onSendNewQuery: (query: string) => Promise<void>;
}

/**
 * Props for AnswerIndicator component (edge decoration)
 */
export interface AnswerIndicatorProps {
  status: 'idle' | 'sending' | 'processing' | 'answered' | 'error';
  error?: string;
}

// ============================================================================
// VALIDATION TYPES
// ============================================================================

/**
 * Result of validating if two nodes can use Ask/Answer
 */
export interface AskAnswerValidationResult {
  valid: boolean;
  error?: string;
  reason?: 'both_must_be_genesis_bots' | 'edge_not_found' | 'nodes_not_connected' | 'already_enabled';
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const ASK_ANSWER_CONSTANTS = {
  MAX_QUERY_LENGTH: 5000,
  MAX_HISTORY_ENTRIES: 50,
  QUERY_TIMEOUT_MS: 60000, // 60 seconds
  DEBOUNCE_MS: 500,
} as const;
