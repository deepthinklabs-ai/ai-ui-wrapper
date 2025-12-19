/**
 * useSystemStatus Hook
 *
 * Fetches and caches system status (kill switches) from the server.
 * Used to check if features like signups, OAuth, payments are enabled.
 */

import { useState, useEffect } from 'react';

export type SystemStatus = {
  signups_enabled: boolean;
  oauth_enabled: boolean;
  payments_enabled: boolean;
  ai_enabled: boolean;
};

const DEFAULT_STATUS: SystemStatus = {
  signups_enabled: true,
  oauth_enabled: true,
  payments_enabled: true,
  ai_enabled: true,
};

// Cache the status for 30 seconds
let cachedStatus: SystemStatus | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 30_000;

export function useSystemStatus() {
  const [status, setStatus] = useState<SystemStatus>(cachedStatus || DEFAULT_STATUS);
  const [loading, setLoading] = useState(!cachedStatus);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Return cached value if still valid
    if (cachedStatus && Date.now() < cacheExpiry) {
      setStatus(cachedStatus);
      setLoading(false);
      return;
    }

    async function fetchStatus() {
      try {
        const response = await fetch('/api/status');
        if (!response.ok) {
          throw new Error('Failed to fetch system status');
        }
        const data = await response.json();
        cachedStatus = data;
        cacheExpiry = Date.now() + CACHE_TTL;
        setStatus(data);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch system status:', err);
        setError('Failed to check system status');
        // Use defaults on error
        setStatus(DEFAULT_STATUS);
      } finally {
        setLoading(false);
      }
    }

    fetchStatus();
  }, []);

  return { status, loading, error };
}

/**
 * Check if signups are enabled
 */
export function useSignupsEnabled() {
  const { status, loading } = useSystemStatus();
  return { enabled: status.signups_enabled, loading };
}

/**
 * Check if OAuth is enabled
 */
export function useOAuthEnabled() {
  const { status, loading } = useSystemStatus();
  return { enabled: status.oauth_enabled, loading };
}

/**
 * Check if payments are enabled
 */
export function usePaymentsEnabled() {
  const { status, loading } = useSystemStatus();
  return { enabled: status.payments_enabled, loading };
}

/**
 * Check if AI features are enabled
 */
export function useAIEnabled() {
  const { status, loading } = useSystemStatus();
  return { enabled: status.ai_enabled, loading };
}
