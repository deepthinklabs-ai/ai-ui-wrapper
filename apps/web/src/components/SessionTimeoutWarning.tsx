"use client";

import { useSessionOptional } from "@/contexts/SessionContext";

/**
 * Session Timeout Warning Modal
 * Shows when session is about to expire, allowing user to extend or logout
 */
export function SessionTimeoutWarning() {
  const session = useSessionOptional();

  // Don't render if not in session context or no warning needed
  if (!session || !session.showTimeoutWarning) {
    return null;
  }

  const { timeRemaining, extendSession, endSession } = session;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-zinc-900">
        {/* Warning Icon */}
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30">
            <svg
              className="h-6 w-6 text-amber-600 dark:text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="mb-2 text-center text-lg font-semibold text-zinc-900 dark:text-white">
          Session Expiring Soon
        </h2>

        {/* Message */}
        <p className="mb-4 text-center text-sm text-zinc-600 dark:text-zinc-400">
          Your session will expire in{" "}
          <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
            {timeRemaining}
          </span>{" "}
          due to inactivity. Would you like to stay logged in?
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={() => endSession("manual_logout")}
            className="flex-1 rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Log Out
          </button>
          <button
            onClick={extendSession}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            Stay Logged In
          </button>
        </div>

        {/* Security note */}
        <p className="mt-4 text-center text-xs text-zinc-500 dark:text-zinc-500">
          For your security, sessions automatically expire after periods of
          inactivity.
        </p>
      </div>
    </div>
  );
}
