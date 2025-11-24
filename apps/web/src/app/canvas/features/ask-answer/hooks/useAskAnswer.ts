/**
 * useAskAnswer Hook
 *
 * Main state management hook for Ask/Answer feature.
 * Handles enabling/disabling, sending queries, and managing answers.
 */

import { useState, useCallback } from 'react';
import { useCanvasContext } from '../../../context/CanvasStateContext';
import type {
  UseAskAnswerResult,
  AskAnswerQueryParams,
  AskAnswerQueryResponse,
  PendingAnswer,
  QueryHistoryEntry,
  AskAnswerEdgeMetadata,
} from '../types';
import type { EdgeId, NodeId } from '../../../types';
import {
  validateAskAnswerEligibility,
  validateQuery,
  isAskAnswerEnabled as checkEnabled,
  findEdgeBetweenNodes,
  sanitizeQuery,
  generateQueryId,
} from '../lib/validation';

export function useAskAnswer(): UseAskAnswerResult {
  const { nodes, edges } = useCanvasContext();
  const [isSendingQuery, setIsSendingQuery] = useState(false);
  const [isProcessingQuery, setIsProcessingQuery] = useState(false);

  /**
   * Check if Ask/Answer is enabled on an edge
   */
  const isEnabled = useCallback(
    (edgeId: EdgeId): boolean => {
      const edge = edges.list.find((e) => e.id === edgeId);
      return checkEnabled(edge || null);
    },
    [edges.list]
  );

  /**
   * Check if a node can ask a question to another node
   */
  const canAskQuestion = useCallback(
    (fromNodeId: NodeId, toNodeId: NodeId): boolean => {
      const fromNode = nodes.list.find((n) => n.id === fromNodeId);
      const toNode = nodes.list.find((n) => n.id === toNodeId);
      const edge = findEdgeBetweenNodes(edges.list, fromNodeId, toNodeId);

      const validation = validateAskAnswerEligibility(
        fromNode || null,
        toNode || null,
        edge
      );

      return validation.valid && checkEnabled(edge);
    },
    [nodes.list, edges.list]
  );

  /**
   * Get pending answer for review
   */
  const getPendingAnswer = useCallback(
    (fromNodeId: NodeId, edgeId: EdgeId): PendingAnswer | null => {
      const edge = edges.list.find((e) => e.id === edgeId);
      if (!edge || !edge.metadata?.askAnswerMetadata?.lastQuery) {
        return null;
      }

      const lastQuery = edge.metadata.askAnswerMetadata.lastQuery;
      if (lastQuery.status !== 'answered' || !lastQuery.answer) {
        return null;
      }

      const fromNode = nodes.list.find((n) => n.id === fromNodeId);
      const toNode = nodes.list.find((n) => n.id === edge.to_node_id);

      return {
        queryId: lastQuery.id,
        query: lastQuery.query,
        answer: lastQuery.answer,
        timestamp: lastQuery.timestamp,
        fromNodeName: fromNode?.label || 'Unknown',
        toNodeName: toNode?.label || 'Unknown',
      };
    },
    [edges.list, nodes.list]
  );

  /**
   * Get query history for an edge
   */
  const getQueryHistory = useCallback(
    (edgeId: EdgeId): QueryHistoryEntry[] => {
      const edge = edges.list.find((e) => e.id === edgeId);
      if (!edge || !edge.metadata?.askAnswerMetadata?.queryHistory) {
        return [];
      }

      return edge.metadata.askAnswerMetadata.queryHistory;
    },
    [edges.list]
  );

  /**
   * Enable Ask/Answer on an edge
   */
  const enableAskAnswer = useCallback(
    async (edgeId: EdgeId): Promise<boolean> => {
      const edge = edges.list.find((e) => e.id === edgeId);
      if (!edge) {
        console.error('[useAskAnswer] Edge not found:', edgeId);
        return false;
      }

      const fromNode = nodes.list.find((n) => n.id === edge.from_node_id);
      const toNode = nodes.list.find((n) => n.id === edge.to_node_id);

      // Validate eligibility
      const validation = validateAskAnswerEligibility(
        fromNode || null,
        toNode || null,
        edge
      );

      if (!validation.valid) {
        console.error('[useAskAnswer] Validation failed:', validation.error);
        return false;
      }

      // Update edge metadata
      const newMetadata: AskAnswerEdgeMetadata = {
        askAnswerEnabled: true,
        queryHistory: [],
      };

      const success = await edges.update(edgeId, {
        metadata: {
          ...edge.metadata,
          askAnswerEnabled: true,
          askAnswerMetadata: newMetadata,
        },
      });

      if (success) {
        console.log('[useAskAnswer] Enabled Ask/Answer on edge:', edgeId);
      }

      return success;
    },
    [edges, nodes.list]
  );

  /**
   * Disable Ask/Answer on an edge
   */
  const disableAskAnswer = useCallback(
    async (edgeId: EdgeId): Promise<boolean> => {
      const edge = edges.list.find((e) => e.id === edgeId);
      if (!edge) {
        console.error('[useAskAnswer] Edge not found:', edgeId);
        return false;
      }

      const success = await edges.update(edgeId, {
        metadata: {
          ...edge.metadata,
          askAnswerEnabled: false,
          askAnswerMetadata: undefined,
        },
      });

      if (success) {
        console.log('[useAskAnswer] Disabled Ask/Answer on edge:', edgeId);
      }

      return success;
    },
    [edges]
  );

  /**
   * Send a query from Node A to Node B
   */
  const sendQuery = useCallback(
    async (params: AskAnswerQueryParams): Promise<AskAnswerQueryResponse> => {
      const { fromNodeId, toNodeId, edgeId, query } = params;

      // Validate query
      const queryValidation = validateQuery(query);
      if (!queryValidation.valid) {
        return {
          success: false,
          queryId: '',
          error: queryValidation.error,
          timestamp: new Date().toISOString(),
        };
      }

      // Validate nodes and edge
      const fromNode = nodes.list.find((n) => n.id === fromNodeId);
      const toNode = nodes.list.find((n) => n.id === toNodeId);
      const edge = edges.list.find((e) => e.id === edgeId);

      const validation = validateAskAnswerEligibility(
        fromNode || null,
        toNode || null,
        edge || null
      );

      if (!validation.valid) {
        return {
          success: false,
          queryId: '',
          error: validation.error,
          timestamp: new Date().toISOString(),
        };
      }

      setIsSendingQuery(true);

      try {
        const queryId = generateQueryId();
        const sanitized = sanitizeQuery(query);
        const timestamp = new Date().toISOString();

        // Update edge metadata to show query is sending
        await edges.update(edgeId, {
          metadata: {
            ...edge!.metadata,
            askAnswerMetadata: {
              ...(edge!.metadata?.askAnswerMetadata || {}),
              lastQuery: {
                id: queryId,
                query: sanitized,
                timestamp,
                status: 'sending',
              },
            },
          },
        });

        // Call API to process query
        const response = await fetch('/api/canvas/ask-answer/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            canvasId: edge!.canvas_id,
            fromNodeId,
            toNodeId,
            edgeId,
            query: sanitized,
            queryId,
            fromNodeConfig: fromNode?.config,
            toNodeConfig: toNode?.config,
          }),
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`);
        }

        const result: AskAnswerQueryResponse = await response.json();

        // Update edge metadata with answer
        if (result.success && result.answer) {
          const currentMetadata = edge!.metadata?.askAnswerMetadata || {};
          const history = currentMetadata.queryHistory || [];

          await edges.update(edgeId, {
            metadata: {
              ...edge!.metadata,
              askAnswerMetadata: {
                ...currentMetadata,
                lastQuery: {
                  id: queryId,
                  query: sanitized,
                  answer: result.answer,
                  timestamp,
                  status: 'answered',
                },
                queryHistory: [
                  ...history,
                  {
                    id: queryId,
                    query: sanitized,
                    answer: result.answer,
                    timestamp,
                    duration_ms: result.duration_ms || 0,
                  },
                ].slice(-50), // Keep last 50 entries
              },
            },
          });
        } else {
          // Update with error status
          await edges.update(edgeId, {
            metadata: {
              ...edge!.metadata,
              askAnswerMetadata: {
                ...(edge!.metadata?.askAnswerMetadata || {}),
                lastQuery: {
                  id: queryId,
                  query: sanitized,
                  timestamp,
                  status: 'error',
                  error: result.error || 'Unknown error',
                },
              },
            },
          });
        }

        return result;
      } catch (error) {
        console.error('[useAskAnswer] Error sending query:', error);

        return {
          success: false,
          queryId: '',
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        };
      } finally {
        setIsSendingQuery(false);
      }
    },
    [nodes.list, edges]
  );

  /**
   * Clear answer from review
   */
  const clearAnswer = useCallback(
    async (fromNodeId: NodeId, queryId: string): Promise<boolean> => {
      // Find edge with this query
      const edge = edges.list.find(
        (e) =>
          e.from_node_id === fromNodeId &&
          e.metadata?.askAnswerMetadata?.lastQuery?.id === queryId
      );

      if (!edge) {
        console.error('[useAskAnswer] Edge not found for query:', queryId);
        return false;
      }

      // Clear lastQuery but keep history
      const metadata = edge.metadata?.askAnswerMetadata || {};
      const success = await edges.update(edge.id, {
        metadata: {
          ...edge.metadata,
          askAnswerMetadata: {
            ...metadata,
            lastQuery: undefined,
          },
        },
      });

      return success;
    },
    [edges]
  );

  /**
   * Clear query history
   */
  const clearHistory = useCallback(
    async (edgeId: EdgeId): Promise<boolean> => {
      const edge = edges.list.find((e) => e.id === edgeId);
      if (!edge) {
        console.error('[useAskAnswer] Edge not found:', edgeId);
        return false;
      }

      const success = await edges.update(edgeId, {
        metadata: {
          ...edge.metadata,
          askAnswerMetadata: {
            ...(edge.metadata?.askAnswerMetadata || {}),
            queryHistory: [],
          },
        },
      });

      return success;
    },
    [edges]
  );

  return {
    // State
    isEnabled,
    canAskQuestion,
    getPendingAnswer,
    getQueryHistory,

    // Actions
    enableAskAnswer,
    disableAskAnswer,
    sendQuery,
    clearAnswer,
    clearHistory,

    // Loading states
    isSendingQuery,
    isProcessingQuery,
  };
}
