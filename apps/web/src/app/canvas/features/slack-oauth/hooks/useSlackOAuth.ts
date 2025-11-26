/**
 * useSlackOAuth Hook
 *
 * Hook for managing Slack OAuth connection state.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthSession } from '@/hooks/useAuthSession';
import type { SlackConnectionStatus, SlackConnectionInfo } from '../types';

interface UseSlackOAuthResult {
  connection: SlackConnectionInfo | null;
  status: SlackConnectionStatus;
  isLoading: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => Promise<void>;
  refreshStatus: () => Promise<void>;
}

export function useSlackOAuth(): UseSlackOAuthResult {
  const { user } = useAuthSession();
  const [connection, setConnection] = useState<SlackConnectionInfo | null>(null);
  const [status, setStatus] = useState<SlackConnectionStatus>('disconnected');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    if (!user?.id) {
      setStatus('disconnected');
      setConnection(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/canvas/slack/status?userId=${user.id}`);
      const data = await response.json();

      if (data.connected) {
        setStatus('connected');
        setConnection({
          id: data.connectionId,
          workspaceId: data.workspaceId,
          workspaceName: data.workspaceName,
          status: 'connected',
          connectedAt: data.connectedAt,
        });
      } else {
        setStatus('disconnected');
        setConnection(null);
      }
    } catch (err) {
      console.error('[useSlackOAuth] Error checking status:', err);
      setError(err instanceof Error ? err.message : 'Failed to check Slack connection');
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  // Check connection status on mount and when user changes
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Check for OAuth completion (redirect back from Slack)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthSuccess = params.get('oauth_success');
    const oauthError = params.get('oauth_error');
    const provider = params.get('provider');

    if (provider === 'slack') {
      if (oauthSuccess === 'true') {
        // Refresh status to get new connection
        refreshStatus();
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      } else if (oauthError) {
        setError(`Slack OAuth failed: ${oauthError}`);
        setStatus('error');
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  }, [refreshStatus]);

  const connect = useCallback(() => {
    if (!user?.id) {
      setError('User not authenticated');
      return;
    }

    // Redirect to Slack OAuth
    window.location.href = `/api/oauth/slack/authorize?userId=${user.id}`;
  }, [user?.id]);

  const disconnect = useCallback(async () => {
    if (!user?.id) return;

    try {
      setIsLoading(true);
      // For now, just refresh status - could add revoke endpoint later
      // await fetch(`/api/oauth/slack/revoke?userId=${user.id}`, { method: 'POST' });
      await refreshStatus();
    } catch (err) {
      console.error('[useSlackOAuth] Error disconnecting:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, refreshStatus]);

  return {
    connection,
    status,
    isLoading,
    error,
    connect,
    disconnect,
    refreshStatus,
  };
}
