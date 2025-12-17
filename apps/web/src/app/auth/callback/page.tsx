"use client";

/**
 * @security-audit-requested
 * AUDIT FOCUS: Auth callback token handling
 * - Are tokens in URL hash fragments safe from logging/referrer leaks?
 * - Is setSession() secure (can malicious tokens be injected)?
 * - Can the 'type' parameter be manipulated for privilege escalation?
 * - Is the PKCE code exchange properly validated?
 * - Are error messages safe from XSS?
 * - Is there proper cleanup of tokens from URL after processing?
 */

/**
 * Supabase Auth Callback Page
 *
 * Handles authentication callbacks from Supabase, including:
 * - Password recovery (reset password flow)
 * - Email confirmation
 * - OAuth callbacks
 *
 * Supabase sends tokens in URL hash fragments (#access_token=...&type=recovery)
 * which can only be read client-side, so this must be a client component.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the hash fragment from the URL
        const hashParams = new URLSearchParams(
          window.location.hash.substring(1) // Remove the # character
        );

        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const type = hashParams.get("type");

        // Also check for PKCE flow (query params with code)
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get("code");

        if (code) {
          // PKCE flow - exchange code for session
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            throw exchangeError;
          }

          // SECURITY: Clean up sensitive tokens from URL to prevent leaks via
          // browser history, referrer headers, or logging
          window.history.replaceState(null, '', window.location.pathname);

          // Check if this was a recovery flow
          const { data: { session } } = await supabase.auth.getSession();
          // For recovery, Supabase sets a special flag - check the URL type param
          const recoveryType = urlParams.get("type");
          if (recoveryType === "recovery") {
            router.replace("/auth/reset-password");
            return;
          }

          router.replace("/dashboard");
          return;
        }

        if (accessToken && refreshToken) {
          // Set the session using the tokens from the hash
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            throw sessionError;
          }

          // SECURITY: Clean up sensitive tokens from URL hash to prevent leaks via
          // browser history, referrer headers, or logging
          window.history.replaceState(null, '', window.location.pathname);

          // Handle different callback types
          if (type === "recovery") {
            // Password recovery - redirect to reset password page
            router.replace("/auth/reset-password");
            return;
          }

          // For other types (signup confirmation, etc.), redirect to dashboard
          router.replace("/dashboard");
          return;
        }

        // No valid tokens found
        throw new Error("No authentication tokens found in callback URL");
      } catch (err: any) {
        console.error("Auth callback error:", err);
        setError(err.message || "Authentication failed");
        setProcessing(false);
      }
    };

    handleCallback();
  }, [router]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-slate-100">
              AI Chat Platform
            </h1>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-6">
            <div className="rounded-md bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              <p className="font-medium">Authentication Error</p>
              <p className="mt-1">{error}</p>
            </div>

            <button
              onClick={() => router.push("/auth")}
              className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-100">
            AI Chat Platform
          </h1>
          <p className="mt-4 text-slate-400">
            {processing ? "Processing authentication..." : "Redirecting..."}
          </p>
          <div className="mt-4 flex justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-blue-500"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
