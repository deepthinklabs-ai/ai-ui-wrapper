/**
 * useGmailOAuth Hook
 *
 * Manages Gmail OAuth connection state for Genesis Bot nodes.
 * Handles connecting, disconnecting, and checking connection status.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthSession } from '@/hooks/useAuthSession';
import type { GmailConnectionInfo, GmailConnectionStatus } from '../types';

interface UseGmailOAuthResult {
  // Connection state
  connection: GmailConnectionInfo | null;
  status: GmailConnectionStatus;
  isLoading: boolean;
  error: string | null;

  // Actions
  connect: () => void;
  disconnect: () => Promise<boolean>;
  refreshStatus: () => Promise<void>;
}

export function useGmailOAuth(): UseGmailOAuthResult {
  const { user } = useAuthSession();
  const [connection, setConnection] = useState<GmailConnectionInfo | null>(null);
  const [status, setStatus] = useState<GmailConnectionStatus>('disconnected');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch current connection status
   */
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

      const response = await fetch(`/api/canvas/gmail/status?userId=${user.id}`);

      if (!response.ok) {
        if (response.status === 404) {
          // No connection exists
          setStatus('disconnected');
          setConnection(null);
          return;
        }
        throw new Error('Failed to fetch Gmail connection status');
      }

      const data = await response.json();

      if (data.connected) {
        setConnection({
          id: data.connectionId,
          email: data.email,
          name: data.name,
          picture: data.picture,
          status: data.status as GmailConnectionStatus,
          connectedAt: data.connectedAt,
          lastUsedAt: data.lastUsedAt,
          scopes: data.scopes || [],
        });
        setStatus(data.status as GmailConnectionStatus);
      } else {
        setStatus('disconnected');
        setConnection(null);
      }
    } catch (err) {
      console.error('[useGmailOAuth] Error fetching status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  /**
   * Initiate OAuth connection flow
   */
  const connect = useCallback(() => {
    if (!user?.id) {
      setError('User must be logged in to connect Gmail');
      return;
    }

    // Store return URL for after OAuth
    const returnUrl = window.location.href;
    sessionStorage.setItem('gmail_oauth_return_url', returnUrl);

    // Redirect to OAuth authorization endpoint with service=gmail
    // This will only request Gmail scopes, not Calendar/Sheets/Docs
    window.location.href = `/api/oauth/google/authorize?userId=${user.id}&service=gmail`;
  }, [user?.id]);

  /**
   * Disconnect OAuth connection
   */
  const disconnect = useCallback(async (): Promise<boolean> => {
    if (!user?.id || !connection?.id) {
      return false;
    }

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/oauth/google/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect Gmail');
      }

      setConnection(null);
      setStatus('disconnected');
      return true;
    } catch (err) {
      console.error('[useGmailOAuth] Error disconnecting:', err);
      setError(err instanceof Error ? err.message : 'Failed to disconnect');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, connection?.id]);

  // Fetch status on mount and when user changes
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  // Check for OAuth callback return
  useEffect(() => {
    const returnUrl = sessionStorage.getItem('gmail_oauth_return_url');
    if (returnUrl) {
      sessionStorage.removeItem('gmail_oauth_return_url');
      // Refresh status after OAuth callback
      refreshStatus();
    }
  }, [refreshStatus]);

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
