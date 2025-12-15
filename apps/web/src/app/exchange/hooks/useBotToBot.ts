/**
 * useBotToBot Hook
 *
 * Handles bot-to-bot queries where a user can send a single query
 * from their conversation to a posted chatbot on the Exchange.
 */

'use client';

import { useState, useCallback } from 'react';
import { useAuthSession } from '@/hooks/useAuthSession';

interface BotQueryResult {
  success: boolean;
  response?: string;
  tokens_used?: number;
  remaining_queries?: number;
  chatbot_name?: string;
  error?: string;
}

interface UseBotToBotResult {
  sending: boolean;
  error: string | null;
  lastResult: BotQueryResult | null;
  remainingQueries: number | null;
  sendQuery: (targetPostId: string, query: string, context?: string) => Promise<BotQueryResult>;
  clearError: () => void;
  clearResult: () => void;
}

export function useBotToBot(): UseBotToBotResult {
  const { user } = useAuthSession();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<BotQueryResult | null>(null);
  const [remainingQueries, setRemainingQueries] = useState<number | null>(null);

  /**
   * Send a bot-to-bot query
   */
  const sendQuery = useCallback(
    async (
      targetPostId: string,
      query: string,
      context?: string
    ): Promise<BotQueryResult> => {
      if (!user?.id) {
        const result = { success: false, error: 'You must be logged in to use bot-to-bot queries' };
        setError(result.error);
        return result;
      }

      setSending(true);
      setError(null);

      try {
        const res = await fetch('/api/exchange/bot-query', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': user.id,
          },
          body: JSON.stringify({
            target_post_id: targetPostId,
            query,
            context,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          const result: BotQueryResult = {
            success: false,
            error: data.error || 'Failed to send query',
          };
          setError(result.error || null);
          setLastResult(result);
          return result;
        }

        const result: BotQueryResult = {
          success: true,
          response: data.response,
          tokens_used: data.tokens_used,
          remaining_queries: data.remaining_queries,
          chatbot_name: data.chatbot_name,
        };

        setLastResult(result);
        setRemainingQueries(data.remaining_queries);

        return result;
      } catch (err: any) {
        const result: BotQueryResult = {
          success: false,
          error: err.message || 'Failed to send query',
        };
        setError(result.error || null);
        setLastResult(result);
        return result;
      } finally {
        setSending(false);
      }
    },
    [user?.id]
  );

  /**
   * Clear the current error
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Clear the last result
   */
  const clearResult = useCallback(() => {
    setLastResult(null);
  }, []);

  return {
    sending,
    error,
    lastResult,
    remainingQueries,
    sendQuery,
    clearError,
    clearResult,
  };
}

export default useBotToBot;
