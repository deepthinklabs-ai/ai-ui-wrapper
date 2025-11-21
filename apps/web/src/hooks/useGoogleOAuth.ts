/**
 * useGoogleOAuth Hook
 * React hook for managing Google OAuth connection
 * Portable - can be used on any page
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthSession } from './useAuthSession';
import { supabase } from '@/lib/supabaseClient';

type OAuthStatus = 'connected' | 'disconnected' | 'loading' | 'error';

type GoogleOAuthConnection = {
  id: string;
  provider_email: string;
  provider_name: string | null;
  provider_picture: string | null;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
};

export function useGoogleOAuth() {
  const { user } = useAuthSession();
  const [status, setStatus] = useState<OAuthStatus>('loading');
  const [connection, setConnection] = useState<GoogleOAuthConnection | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch connection status
  const fetchConnection = useCallback(async () => {
    if (!user) {
      setStatus('disconnected');
      setConnection(null);
      return;
    }

    try {
      setStatus('loading');

      const { data, error: fetchError } = await supabase
        .from('oauth_connections')
        .select('id, provider_email, provider_name, provider_picture, scopes, last_used_at, created_at')
        .eq('user_id', user.id)
        .eq('provider', 'google')
        .eq('status', 'active')
        .single();

      if (fetchError || !data) {
        setStatus('disconnected');
        setConnection(null);
      } else {
        setStatus('connected');
        setConnection(data);
      }
    } catch (err: any) {
      console.error('Error fetching OAuth connection:', err);
      setStatus('error');
      setError(err.message);
    }
  }, [user]);

  // Initial fetch
  useEffect(() => {
    fetchConnection();
  }, [fetchConnection]);

  // Connect to Google
  const connect = useCallback(async () => {
    if (!user) {
      setError('You must be logged in to connect Google');
      return;
    }

    try {
      // Redirect to authorization endpoint
      window.location.href = `/api/oauth/google/authorize?userId=${user.id}`;
    } catch (err: any) {
      console.error('Error initiating OAuth:', err);
      setError(err.message);
    }
  }, [user]);

  // Disconnect from Google
  const disconnect = useCallback(async () => {
    if (!user) {
      setError('You must be logged in');
      return;
    }

    try {
      setStatus('loading');

      const response = await fetch('/api/oauth/google/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: user.id }),
      });

      if (!response.ok) {
        throw new Error('Failed to revoke Google access');
      }

      setStatus('disconnected');
      setConnection(null);
    } catch (err: any) {
      console.error('Error revoking OAuth:', err);
      setStatus('error');
      setError(err.message);
    }
  }, [user]);

  // Refresh connection data
  const refresh = useCallback(() => {
    fetchConnection();
  }, [fetchConnection]);

  return {
    status,
    connection,
    error,
    isConnected: status === 'connected',
    isLoading: status === 'loading',
    connect,
    disconnect,
    refresh,
  };
}
