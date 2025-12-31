"use client";

import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getCSRFToken } from "@/hooks/useCSRF";
import {
  useBYOKStatus,
  getProviderDisplayName,
  getProviderKeyUrl,
  type BYOKProvider,
} from "@/hooks/useBYOKStatus";

type ProviderConfig = {
  provider: BYOKProvider;
  placeholder: string;
  keyPrefix: string;
};

const PROVIDERS: ProviderConfig[] = [
  { provider: "openai", placeholder: "sk-...", keyPrefix: "sk-" },
  { provider: "claude", placeholder: "sk-ant-...", keyPrefix: "sk-ant-" },
  { provider: "grok", placeholder: "xai-...", keyPrefix: "xai-" },
  { provider: "gemini", placeholder: "AIza...", keyPrefix: "AIza" },
];

export default function BYOKSettings() {
  const { status, loading, refresh } = useBYOKStatus();

  // Helper to get current session token
  const getAccessToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }, []);

  const [savingProvider, setSavingProvider] = useState<BYOKProvider | null>(null);
  const [deletingProvider, setDeletingProvider] = useState<BYOKProvider | null>(null);
  const [keyInputs, setKeyInputs] = useState<Record<BYOKProvider, string>>({
    openai: "",
    claude: "",
    grok: "",
    gemini: "",
  });
  const [showKeys, setShowKeys] = useState<Record<BYOKProvider, boolean>>({
    openai: false,
    claude: false,
    grok: false,
    gemini: false,
  });
  const [errors, setErrors] = useState<Record<BYOKProvider, string | null>>({
    openai: null,
    claude: null,
    grok: null,
    gemini: null,
  });
  const [successes, setSuccesses] = useState<Record<BYOKProvider, boolean>>({
    openai: false,
    claude: false,
    grok: false,
    gemini: false,
  });

  const handleSaveKey = async (provider: BYOKProvider) => {
    const apiKey = keyInputs[provider].trim();
    if (!apiKey) {
      setErrors((prev) => ({ ...prev, [provider]: "API key is required" }));
      return;
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setErrors((prev) => ({ ...prev, [provider]: "Please sign in to save API keys" }));
      return;
    }

    setSavingProvider(provider);
    setErrors((prev) => ({ ...prev, [provider]: null }));
    setSuccesses((prev) => ({ ...prev, [provider]: false }));

    try {
      const csrfToken = getCSRFToken();
      const response = await fetch("/api/byok/store", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({ provider, apiKey }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to save API key");
      }

      // Clear input and show success
      setKeyInputs((prev) => ({ ...prev, [provider]: "" }));
      setSuccesses((prev) => ({ ...prev, [provider]: true }));

      // Refresh status
      await refresh();

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccesses((prev) => ({ ...prev, [provider]: false }));
      }, 3000);
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, [provider]: err.message }));
    } finally {
      setSavingProvider(null);
    }
  };

  const handleDeleteKey = async (provider: BYOKProvider) => {
    const accessToken = await getAccessToken();
    if (!accessToken) return;

    setDeletingProvider(provider);
    setErrors((prev) => ({ ...prev, [provider]: null }));

    try {
      const csrfToken = getCSRFToken();
      const response = await fetch(`/api/byok/delete?provider=${provider}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to remove API key");
      }

      // Refresh status
      await refresh();
    } catch (err: any) {
      setErrors((prev) => ({ ...prev, [provider]: err.message }));
    } finally {
      setDeletingProvider(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-white/40 bg-white/60 backdrop-blur-md p-6">
        <div className="animate-pulse">
          <div className="h-6 w-32 bg-foreground/10 rounded mb-2"></div>
          <div className="h-4 w-64 bg-foreground/5 rounded mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-foreground/5 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/40 bg-white/60 backdrop-blur-md p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">API Keys</h3>
        <p className="text-sm text-foreground/60 mt-1">
          Configure your AI provider API keys. Keys are stored securely and never
          visible after saving.
        </p>
      </div>

      <div className="space-y-4">
        {PROVIDERS.map(({ provider, placeholder, keyPrefix }) => {
          const isConfigured = status[provider];
          const isSaving = savingProvider === provider;
          const isDeleting = deletingProvider === provider;
          const error = errors[provider];
          const success = successes[provider];
          const showKey = showKeys[provider];
          const inputValue = keyInputs[provider];

          return (
            <div
              key={provider}
              className="rounded-lg border border-white/30 bg-white/40 p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-foreground">
                    {getProviderDisplayName(provider)}
                  </span>
                  {isConfigured ? (
                    <span className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-600 ring-1 ring-inset ring-green-500/30">
                      Configured
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-foreground/5 px-2 py-0.5 text-xs font-medium text-foreground/60 ring-1 ring-inset ring-foreground/10">
                      Not configured
                    </span>
                  )}
                </div>
                <a
                  href={getProviderKeyUrl(provider)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-sky hover:text-sky/80"
                >
                  Get API key
                </a>
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKey ? "text" : "password"}
                    value={inputValue}
                    onChange={(e) =>
                      setKeyInputs((prev) => ({
                        ...prev,
                        [provider]: e.target.value,
                      }))
                    }
                    placeholder={isConfigured ? "Enter new key to update" : placeholder}
                    className="w-full rounded-md border border-foreground/20 bg-white/80 px-3 py-2 text-sm text-foreground placeholder-foreground/40 focus:border-sky focus:outline-none focus:ring-1 focus:ring-sky"
                    disabled={isSaving || isDeleting}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowKeys((prev) => ({
                        ...prev,
                        [provider]: !prev[provider],
                      }))
                    }
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/40 hover:text-foreground/60"
                  >
                    {showKey ? (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                </div>

                <button
                  onClick={() => handleSaveKey(provider)}
                  disabled={isSaving || isDeleting || !inputValue.trim()}
                  className="rounded-md border border-white/40 bg-white/60 px-4 py-2 text-sm font-medium text-foreground hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSaving ? "Testing..." : "Test & Save"}
                </button>

                {isConfigured && (
                  <button
                    onClick={() => handleDeleteKey(provider)}
                    disabled={isSaving || isDeleting}
                    className="rounded-md border border-white/40 bg-white/60 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isDeleting ? "..." : "Remove"}
                  </button>
                )}
              </div>

              {/* Error message */}
              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}

              {/* Success message */}
              {success && (
                <p className="mt-2 text-sm text-green-600">
                  API key saved successfully!
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 pt-4 border-t border-white/30">
        <p className="text-sm text-foreground/60">
          {status.hasAnyKey ? (
            <>
              <span className="text-green-600">Ready to chat!</span> You have at
              least one API key configured.
            </>
          ) : (
            <>
              <span className="text-amber-600">Configure at least one API key</span>{" "}
              to start chatting with AI models.
            </>
          )}
        </p>
      </div>
    </div>
  );
}
