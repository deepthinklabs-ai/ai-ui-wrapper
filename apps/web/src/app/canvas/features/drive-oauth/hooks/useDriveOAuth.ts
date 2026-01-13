/**
 * useDriveOAuth Hook
 *
 * Manages Google Drive OAuth connection state for Genesis Bot nodes.
 * Handles connecting, disconnecting, and checking connection status.
 * Uses the same Google OAuth connection as Gmail/Calendar but checks for Drive scopes.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthSession } from '@/hooks/useAuthSession';
import type { DriveConnectionInfo, DriveConnectionStatus } from '../types';

interface UseDriveOAuthResult {
  // Connection state
  connection: DriveConnectionInfo | null;
  status: DriveConnectionStatus;
  isLoading: boolean;
  error: string | null;

  // Actions
  connect: () => void;
  disconnect: () => Promise<boolean>;
  refreshStatus: () => Promise<void>;
}

export function useDriveOAuth(): UseDriveOAuthResult {
  const { user } = useAuthSession();
  const [connection, setConnection] = useState<DriveConnectionInfo | null>(null);
  const [status, setStatus] = useState<DriveConnectionStatus>('disconnected');
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

      const response = await fetch(`/api/canvas/drive/status?userId=${user.id}`);

      if (!response.ok) {
        if (response.status === 404) {
          // No connection exists
          setStatus('disconnected');
          setConnection(null);
          return;
        }
        throw new Error('Failed to fetch Drive connection status');
      }

      const data = await response.json();

      if (data.connected) {
        setConnection({
          id: data.connectionId,
          email: data.email,
          name: data.name,
          picture: data.picture,
          status: data.status as DriveConnectionStatus,
          connectedAt: data.connectedAt,
          lastUsedAt: data.lastUsedAt,
          scopes: data.scopes || [],
        });
        setStatus(data.status as DriveConnectionStatus);
      } else {
        setStatus('disconnected');
        setConnection(null);
        if (data.reason) {
          setError(data.reason);
        }
      }
    } catch (err) {
      console.error('[useDriveOAuth] Error fetching status:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  /**
   * Initiate OAuth connection flow
   * Note: Drive scopes are included in the full Google OAuth flow
   * We redirect to Settings to connect all Google services at once
   */
  const connect = useCallback(() => {
    if (!user?.id) {
      setError('User must be logged in to connect Drive');
      return;
    }

    // Store return URL for after OAuth
    const returnUrl = window.location.href;
    sessionStorage.setItem('drive_oauth_return_url', returnUrl);

    // Redirect to OAuth authorization endpoint
    // Drive uses full Google OAuth (no service-specific endpoint)
    window.location.href = `/api/oauth/google/authorize?userId=${user.id}`;
  }, [user?.id]);

  /**
   * Disconnect OAuth connection
   * Note: This disconnects the entire Google connection (Gmail, Calendar, Drive, etc.)
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
        throw new Error('Failed to disconnect Drive');
      }

      setConnection(null);
      setStatus('disconnected');
      return true;
    } catch (err) {
      console.error('[useDriveOAuth] Error disconnecting:', err);
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
    const returnUrl = sessionStorage.getItem('drive_oauth_return_url');
    if (returnUrl) {
      sessionStorage.removeItem('drive_oauth_return_url');
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
