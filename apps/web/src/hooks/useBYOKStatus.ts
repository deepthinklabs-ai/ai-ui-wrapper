"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";

export type BYOKProvider = "openai" | "claude" | "grok" | "gemini";

export type BYOKStatus = {
  openai: boolean;
  claude: boolean;
  grok: boolean;
  gemini: boolean;
  hasAnyKey: boolean;
};

type UseBYOKStatusResult = {
  status: BYOKStatus;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  hasAnyKey: boolean;
};

const DEFAULT_STATUS: BYOKStatus = {
  openai: false,
  claude: false,
  grok: false,
  gemini: false,
  hasAnyKey: false,
};

/**
 * Hook to fetch and manage user's BYOK API key status
 * Returns which providers have keys configured (never the actual keys)
 */
export function useBYOKStatus(): UseBYOKStatusResult {
  const [status, setStatus] = useState<BYOKStatus>(DEFAULT_STATUS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get current session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setStatus(DEFAULT_STATUS);
        setLoading(false);
        return;
      }

      // Fetch BYOK status from API
      const response = await fetch("/api/byok/status", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Failed to fetch API key status");
      }

      const data = await response.json();
      setStatus({
        openai: data.openai || false,
        claude: data.claude || false,
        grok: data.grok || false,
        gemini: data.gemini || false,
        hasAnyKey: data.hasAnyKey || false,
      });
    } catch (err: any) {
      console.error("[useBYOKStatus] Error:", err);
      setError(err.message || "Failed to fetch API key status");
      setStatus(DEFAULT_STATUS);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Listen for auth state changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        fetchStatus();
      } else if (event === "SIGNED_OUT") {
        setStatus(DEFAULT_STATUS);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    refresh: fetchStatus,
    hasAnyKey: status.hasAnyKey,
  };
}

/**
 * Get the display name for a provider
 */
export function getProviderDisplayName(provider: BYOKProvider): string {
  const names: Record<BYOKProvider, string> = {
    openai: "OpenAI",
    claude: "Claude (Anthropic)",
    grok: "Grok (xAI)",
    gemini: "Gemini (Google)",
  };
  return names[provider];
}

/**
 * Get the help URL for getting an API key from a provider
 */
export function getProviderKeyUrl(provider: BYOKProvider): string {
  const urls: Record<BYOKProvider, string> = {
    openai: "https://platform.openai.com/api-keys",
    claude: "https://console.anthropic.com/settings/keys",
    grok: "https://console.x.ai/",
    gemini: "https://aistudio.google.com/app/apikey",
  };
  return urls[provider];
}
