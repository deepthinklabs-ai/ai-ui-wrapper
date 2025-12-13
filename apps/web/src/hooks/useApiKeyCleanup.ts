/**
 * API Key Cleanup Hook
 *
 * With BYOK, API keys are stored server-side in Google Secret Manager,
 * so there's no client-side cleanup needed on logout.
 *
 * This hook is kept for backward compatibility but is now a no-op.
 */

"use client";

/**
 * Hook that was previously used to clear API keys from localStorage on logout.
 * With BYOK (server-side key storage), this is no longer needed.
 */
export function useApiKeyCleanup() {
  // No-op: API keys are now stored server-side in Google Secret Manager
  // No client-side cleanup needed on logout
}
