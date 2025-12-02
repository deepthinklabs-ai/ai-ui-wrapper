/**
 * Google Sheets OAuth Hook
 *
 * Manages Sheets OAuth connection state for Genesis Bot nodes.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { SheetsOAuthConfig, SheetsPermissions } from '../types';

interface UseSheetsOAuthOptions {
  userId: string;
  nodeId: string;
  initialConfig?: SheetsOAuthConfig;
  onConfigChange?: (config: SheetsOAuthConfig) => void;
}

interface SheetsConnectionStatus {
  isConnected: boolean;
  email?: string;
  scopes?: string[];
  lastUsed?: string;
}

const DEFAULT_PERMISSIONS: SheetsPermissions = {
  canRead: true,
  canWrite: false,
  canCreate: false,
  canFormat: false,
};

const DEFAULT_CONFIG: SheetsOAuthConfig = {
  enabled: false,
  connectionId: null,
  permissions: DEFAULT_PERMISSIONS,
};

export function useSheetsOAuth({
  userId,
  nodeId,
  initialConfig,
  onConfigChange,
}: UseSheetsOAuthOptions) {
  const [config, setConfig] = useState<SheetsOAuthConfig>(
    initialConfig || DEFAULT_CONFIG
  );
  const [connectionStatus, setConnectionStatus] = useState<SheetsConnectionStatus>({
    isConnected: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check connection status on mount
  useEffect(() => {
    checkConnectionStatus();
  }, [userId]);

  const checkConnectionStatus = useCallback(async () => {
    if (!userId) return;

    try {
      setIsLoading(true);
      setError(null);

      // Use the same Google OAuth status endpoint - Sheets uses the same connection
      const response = await fetch(`/api/canvas/gmail/status?userId=${userId}`);
      const data = await response.json();

      if (data.isConnected) {
        // Check if Sheets scope is included
        const hasSheetScope = data.scopes?.some((s: string) => s.includes('spreadsheets'));

        setConnectionStatus({
          isConnected: hasSheetScope,
          email: data.email,
          scopes: data.scopes,
          lastUsed: data.lastUsed,
        });

        // If connected and config has no connectionId, update it
        if (hasSheetScope && !config.connectionId) {
          const newConfig = {
            ...config,
            connectionId: data.connectionId,
          };
          setConfig(newConfig);
          onConfigChange?.(newConfig);
        }
      } else {
        setConnectionStatus({ isConnected: false });
      }
    } catch (err) {
      console.error('[Sheets OAuth] Error checking status:', err);
      setError('Failed to check connection status');
      setConnectionStatus({ isConnected: false });
    } finally {
      setIsLoading(false);
    }
  }, [userId, config, onConfigChange]);

  const connect = useCallback(async () => {
    if (!userId) return;

    try {
      setError(null);
      // Redirect to Google OAuth with service=sheets
      // This will only request Sheets scopes, not Gmail/Calendar/Docs
      window.location.href = `/api/oauth/google/authorize?userId=${userId}&service=sheets`;
    } catch (err) {
      console.error('[Sheets OAuth] Error initiating connection:', err);
      setError('Failed to initiate connection');
    }
  }, [userId]);

  const disconnect = useCallback(async () => {
    if (!userId || !config.connectionId) return;

    try {
      setError(null);

      const response = await fetch('/api/oauth/google/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect');
      }

      setConnectionStatus({ isConnected: false });

      const newConfig = {
        ...config,
        enabled: false,
        connectionId: null,
      };
      setConfig(newConfig);
      onConfigChange?.(newConfig);
    } catch (err) {
      console.error('[Sheets OAuth] Error disconnecting:', err);
      setError('Failed to disconnect');
    }
  }, [userId, config, onConfigChange]);

  const updateConfig = useCallback(
    (updates: Partial<SheetsOAuthConfig>) => {
      const newConfig = { ...config, ...updates };
      setConfig(newConfig);
      onConfigChange?.(newConfig);
    },
    [config, onConfigChange]
  );

  const updatePermissions = useCallback(
    (updates: Partial<SheetsPermissions>) => {
      const newPermissions = { ...config.permissions, ...updates };
      updateConfig({ permissions: newPermissions });
    },
    [config.permissions, updateConfig]
  );

  const toggleEnabled = useCallback(() => {
    updateConfig({ enabled: !config.enabled });
  }, [config.enabled, updateConfig]);

  return {
    config,
    connectionStatus,
    isLoading,
    error,
    connect,
    disconnect,
    updateConfig,
    updatePermissions,
    toggleEnabled,
    checkConnectionStatus,
  };
}
