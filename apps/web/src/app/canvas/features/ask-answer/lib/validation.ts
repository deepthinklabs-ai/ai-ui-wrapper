/**
 * Ask/Answer Validation Utilities
 *
 * Validation logic for Ask/Answer feature.
 * Properly segmented to keep validation logic separate from components.
 */

import type { CanvasNode, CanvasEdge, NodeId, EdgeId } from '../../../types';
import type { AskAnswerValidationResult } from '../types';
import { ASK_ANSWER_CONSTANTS } from '../types';

/**
 * Validate if two nodes can use Ask/Answer feature
 */
export function validateAskAnswerEligibility(
  fromNode: CanvasNode | null,
  toNode: CanvasNode | null,
  edge: CanvasEdge | null
): AskAnswerValidationResult {
  // Check if both nodes exist
  if (!fromNode || !toNode) {
    return {
      valid: false,
      error: 'Both nodes must exist',
      reason: 'nodes_not_connected',
    };
  }

  // Check if both nodes are Genesis Bots
  if (fromNode.type !== 'GENESIS_BOT' || toNode.type !== 'GENESIS_BOT') {
    return {
      valid: false,
      error: 'Both nodes must be Genesis Bots',
      reason: 'both_must_be_genesis_bots',
    };
  }

  // Check if edge exists
  if (!edge) {
    return {
      valid: false,
      error: 'Nodes must be connected with an edge',
      reason: 'edge_not_found',
    };
  }

  // Check if nodes are correctly connected
  if (edge.from_node_id !== fromNode.id || edge.to_node_id !== toNode.id) {
    return {
      valid: false,
      error: 'Edge does not connect these nodes correctly',
      reason: 'nodes_not_connected',
    };
  }

  return { valid: true };
}

/**
 * Validate query text
 */
export function validateQuery(query: string): { valid: boolean; error?: string } {
  // Check if query is empty
  if (!query || query.trim().length === 0) {
    return {
      valid: false,
      error: 'Query cannot be empty',
    };
  }

  // Check if query is too long
  if (query.length > ASK_ANSWER_CONSTANTS.MAX_QUERY_LENGTH) {
    return {
      valid: false,
      error: `Query exceeds maximum length of ${ASK_ANSWER_CONSTANTS.MAX_QUERY_LENGTH} characters`,
    };
  }

  // Check for potentially malicious content (basic XSS prevention)
  // SECURITY: Use simpler patterns that are less prone to bypass
  const lowerQuery = query.toLowerCase();
  const dangerousStrings = ['<script', 'javascript:', 'onerror=', 'onload=', 'vbscript:', 'data:'];

  for (const dangerous of dangerousStrings) {
    if (lowerQuery.includes(dangerous)) {
      return {
        valid: false,
        error: 'Query contains potentially unsafe content',
      };
    }
  }

  return { valid: true };
}

/**
 * Check if Ask/Answer is enabled on an edge
 */
export function isAskAnswerEnabled(edge: CanvasEdge | null): boolean {
  if (!edge || !edge.metadata) {
    return false;
  }

  return edge.metadata.askAnswerEnabled === true;
}

/**
 * Get Ask/Answer metadata from edge
 */
export function getAskAnswerMetadata(edge: CanvasEdge | null) {
  if (!edge || !edge.metadata) {
    return null;
  }

  return edge.metadata.askAnswerMetadata || null;
}

/**
 * Check if a query is currently pending/processing
 */
export function hasActivQuery(edge: CanvasEdge | null): boolean {
  const metadata = getAskAnswerMetadata(edge);

  if (!metadata || !metadata.lastQuery) {
    return false;
  }

  const status = metadata.lastQuery.status;
  return status === 'sending' || status === 'processing';
}

/**
 * Check if an answer is ready for review
 */
export function hasAnswerReady(edge: CanvasEdge | null): boolean {
  const metadata = getAskAnswerMetadata(edge);

  if (!metadata || !metadata.lastQuery) {
    return false;
  }

  return metadata.lastQuery.status === 'answered' && !!metadata.lastQuery.answer;
}

/**
 * Find edge between two nodes
 */
export function findEdgeBetweenNodes(
  edges: CanvasEdge[],
  fromNodeId: NodeId,
  toNodeId: NodeId
): CanvasEdge | null {
  return edges.find(
    (edge) => edge.from_node_id === fromNodeId && edge.to_node_id === toNodeId
  ) || null;
}

/**
 * Get all Ask/Answer enabled edges for a node
 */
export function getAskAnswerEdgesForNode(
  edges: CanvasEdge[],
  nodeId: NodeId,
  direction: 'outgoing' | 'incoming' | 'both'
): CanvasEdge[] {
  return edges.filter((edge) => {
    if (!isAskAnswerEnabled(edge)) {
      return false;
    }

    switch (direction) {
      case 'outgoing':
        return edge.from_node_id === nodeId;
      case 'incoming':
        return edge.to_node_id === nodeId;
      case 'both':
        return edge.from_node_id === nodeId || edge.to_node_id === nodeId;
      default:
        return false;
    }
  });
}

/**
 * Sanitize query text for safe processing
 */
export function sanitizeQuery(query: string): string {
  // SECURITY: Iterative tag removal to handle nested/malformed tags
  let result = query.trim();
  let previousResult = '';

  while (result !== previousResult) {
    previousResult = result;
    result = result.replace(/<[^>]*>/g, '');
  }

  return result
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
    .substring(0, ASK_ANSWER_CONSTANTS.MAX_QUERY_LENGTH);
}

/**
 * Generate unique query ID using cryptographically secure randomness
 */
export function generateQueryId(): string {
  // SECURITY: Use crypto.randomUUID() instead of Math.random()
  const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().split('-')[0]
    : Date.now().toString(36);
  return `query_${Date.now()}_${randomPart}`;
}

/**
 * Check if query has timed out
 */
export function hasQueryTimedOut(timestamp: string): boolean {
  const queryTime = new Date(timestamp).getTime();
  const now = Date.now();
  const elapsed = now - queryTime;

  return elapsed > ASK_ANSWER_CONSTANTS.QUERY_TIMEOUT_MS;
}
