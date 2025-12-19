"use client";

/**
 * Admin Kill Switch Management Page
 *
 * Provides a UI for administrators to toggle kill switches.
 * Only accessible to users with is_admin = true.
 */

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type KillSwitch = {
  key: string;
  name: string;
  value: boolean;
  description?: string;
  updatedAt?: string;
  updatedBy?: string;
};

type ConfirmDialogState = {
  isOpen: boolean;
  switchKey: string;
  switchName: string;
  newValue: boolean;
};

// Confirmation dialog for destructive actions
function ConfirmDialog({
  state,
  onConfirm,
  onCancel,
}: {
  state: ConfirmDialogState;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!state.isOpen) return null;

  const isDestructive =
    state.switchKey === "master_kill_switch" && state.newValue;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
        <h3 className="text-lg font-semibold text-slate-100">Confirm Action</h3>
        <p className="mt-2 text-sm text-slate-400">
          Are you sure you want to {state.newValue ? "enable" : "disable"}{" "}
          <span className="font-medium text-slate-200">{state.switchName}</span>
          ? This will affect all users immediately.
        </p>
        {isDestructive && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3">
            <p className="text-sm text-red-400">
              <strong>Warning:</strong> Enabling the Master Kill Switch will
              disable ALL AI API calls across the entire platform.
            </p>
          </div>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md border border-slate-600 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white transition-colors ${
              isDestructive
                ? "bg-red-600 hover:bg-red-500"
                : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {state.newValue ? "Enable" : "Disable"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();
  const [switches, setSwitches] = useState<KillSwitch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    switchKey: "",
    switchName: "",
    newValue: false,
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Get access token from Supabase session
  const getAccessToken = async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  };

  // Fetch kill switches
  const fetchSwitches = useCallback(async () => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      router.push("/auth");
      return;
    }

    try {
      const response = await fetch("/api/admin/kill-switches", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.status === 401) {
        router.push("/auth");
        return;
      }

      if (response.status === 403) {
        router.push("/dashboard");
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch kill switches");
      }

      const data = await response.json();
      setSwitches(data.switches);
      setLastUpdated(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchSwitches();

    // Refresh every 30 seconds
    const interval = setInterval(fetchSwitches, 30000);
    return () => clearInterval(interval);
  }, [fetchSwitches]);

  // Handle toggle
  const handleToggle = (switchData: KillSwitch) => {
    const newValue = !switchData.value;

    // Require confirmation for master kill switch or disabling critical features
    const requiresConfirmation =
      switchData.key === "master_kill_switch" ||
      (switchData.key === "ai_features_enabled" && !newValue) ||
      (switchData.key === "payments_enabled" && !newValue);

    if (requiresConfirmation) {
      setConfirmDialog({
        isOpen: true,
        switchKey: switchData.key,
        switchName: switchData.name,
        newValue,
      });
      return;
    }

    executeToggle(switchData.key, newValue);
  };

  const executeToggle = async (key: string, newValue: boolean) => {
    setUpdating(key);
    setConfirmDialog({
      isOpen: false,
      switchKey: "",
      switchName: "",
      newValue: false,
    });
    setSuccessMessage(null);

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setError("Session expired. Please log in again.");
      setUpdating(null);
      return;
    }

    try {
      const response = await fetch("/api/admin/kill-switches", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key, value: newValue }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update kill switch");
      }

      const data = await response.json();

      // Update local state
      setSwitches((prev) =>
        prev.map((s) => (s.key === key ? { ...s, value: newValue } : s))
      );
      setLastUpdated(new Date());
      setSuccessMessage(data.message);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdating(null);
    }
  };

  // Get switch appearance based on type
  const getSwitchStyle = (switchData: KillSwitch) => {
    // Master kill switch is inverted (ON = bad, OFF = good)
    if (switchData.key === "master_kill_switch") {
      return switchData.value
        ? "border-red-500/30 bg-red-500/10"
        : "border-green-500/30 bg-green-500/10";
    }
    // Other switches: ON = good, OFF = warning
    return switchData.value
      ? "border-green-500/30 bg-green-500/10"
      : "border-amber-500/30 bg-amber-500/10";
  };

  // Get toggle button color
  const getToggleColor = (switchData: KillSwitch) => {
    if (switchData.key === "master_kill_switch") {
      return switchData.value ? "bg-red-600" : "bg-green-600";
    }
    return switchData.value ? "bg-green-600" : "bg-slate-600";
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          <p className="text-slate-400">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-50 overflow-hidden">
      {/* Confirmation Dialog */}
      <ConfirmDialog
        state={confirmDialog}
        onConfirm={() =>
          executeToggle(confirmDialog.switchKey, confirmDialog.newValue)
        }
        onCancel={() =>
          setConfirmDialog({
            isOpen: false,
            switchKey: "",
            switchName: "",
            newValue: false,
          })
        }
      />

      {/* Header */}
      <header className="flex-shrink-0 border-b border-slate-800 bg-slate-900/50 px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              title="Back to Dashboard"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>
            <h1 className="text-2xl font-semibold">Kill Switches</h1>
            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
              Admin Only
            </span>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdated && (
              <span className="text-xs text-slate-500">
                Updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={fetchSwitches}
              className="rounded-md p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
              title="Refresh"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Success Message */}
          {successMessage && (
            <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4 animate-in fade-in slide-in-from-top-2">
              <p className="text-sm text-green-400">{successMessage}</p>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm text-red-400">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-2 text-xs text-red-400 underline hover:text-red-300"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Kill Switch List */}
          <div className="space-y-4">
            {switches.map((switchData) => (
              <div
                key={switchData.key}
                className={`rounded-xl border p-6 transition-colors ${getSwitchStyle(switchData)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-slate-100">
                        {switchData.name}
                      </h3>
                      {switchData.key === "master_kill_switch" && (
                        <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-medium text-red-400">
                          EMERGENCY
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          switchData.key === "master_kill_switch"
                            ? switchData.value
                              ? "bg-red-500/20 text-red-400"
                              : "bg-green-500/20 text-green-400"
                            : switchData.value
                              ? "bg-green-500/20 text-green-400"
                              : "bg-amber-500/20 text-amber-400"
                        }`}
                      >
                        {switchData.key === "master_kill_switch"
                          ? switchData.value
                            ? "ACTIVE"
                            : "INACTIVE"
                          : switchData.value
                            ? "ENABLED"
                            : "DISABLED"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-400">
                      {switchData.description}
                    </p>
                    {switchData.updatedAt && (
                      <p className="mt-2 text-xs text-slate-500">
                        Last changed:{" "}
                        {new Date(switchData.updatedAt).toLocaleString()}
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleToggle(switchData)}
                    disabled={updating === switchData.key}
                    className={`relative ml-4 inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 disabled:cursor-not-allowed ${getToggleColor(switchData)}`}
                    role="switch"
                    aria-checked={switchData.value}
                    aria-label={`Toggle ${switchData.name}`}
                  >
                    {updating === switchData.key ? (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      </span>
                    ) : (
                      <span
                        className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          switchData.value ? "translate-x-6" : "translate-x-0"
                        }`}
                      />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Warning Banner */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
            <div className="flex gap-4">
              <svg
                className="h-6 w-6 flex-shrink-0 text-amber-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <h4 className="font-semibold text-amber-300">Important</h4>
                <p className="mt-1 text-sm text-amber-200/80">
                  Kill switch changes take effect immediately and affect all
                  users. An email notification will be sent to all
                  administrators when any switch is toggled.
                </p>
              </div>
            </div>
          </div>

          {/* Info Section */}
          <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-6">
            <h4 className="font-semibold text-slate-200">
              About Kill Switches
            </h4>
            <ul className="mt-3 space-y-2 text-sm text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-red-400">&#8226;</span>
                <span>
                  <strong>Master Kill Switch:</strong> Emergency shutoff that
                  disables ALL AI API calls. Use for cost spikes or security
                  incidents.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400">&#8226;</span>
                <span>
                  <strong>AI Features:</strong> Enables/disables AI chat and
                  completion features while keeping other services running.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-400">&#8226;</span>
                <span>
                  <strong>OAuth:</strong> Controls third-party connections
                  (Google, Slack). Disable during OAuth provider issues.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-400">&#8226;</span>
                <span>
                  <strong>New Signups:</strong> Controls new user registrations.
                  Disable to close signups temporarily.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-400">&#8226;</span>
                <span>
                  <strong>Payments:</strong> Controls Stripe payment processing.
                  Disable during billing maintenance.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}
