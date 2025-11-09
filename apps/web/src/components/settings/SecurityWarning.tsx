/**
 * Security Warning Component
 *
 * Displays security best practices for API key management
 */

"use client";

import React, { useState } from "react";

const SecurityWarning: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-5">
      <div className="flex items-start gap-3">
        <svg
          className="h-6 w-6 flex-shrink-0 text-amber-400"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <div className="flex-1">
          <h3 className="font-semibold text-amber-300">
            API Key Security Best Practices
          </h3>
          <p className="mt-1 text-sm text-amber-200/90">
            Your API key is stored locally in your browser and automatically cleared when you sign out.
          </p>

          {/* Expandable Section */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="mt-3 flex items-center gap-2 text-sm font-medium text-amber-300 hover:text-amber-200 transition-colors"
          >
            {isExpanded ? "Hide" : "Show"} Security Tips
            <svg
              className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {isExpanded && (
            <div className="mt-4 space-y-3 text-sm text-amber-100/90">
              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 flex-shrink-0 text-green-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <strong className="text-amber-200">Set Spending Limits:</strong> In your OpenAI dashboard,
                  set monthly spending limits to prevent unexpected charges if your key is compromised.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 flex-shrink-0 text-green-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <strong className="text-amber-200">Use Key Permissions:</strong> Create API keys with
                  specific permissions (e.g., read-only, restricted models) to limit potential damage.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 flex-shrink-0 text-green-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <strong className="text-amber-200">Auto-Clear on Logout:</strong> Your API key is
                  automatically removed from your browser when you sign out for added security.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 flex-shrink-0 text-amber-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <strong className="text-amber-200">Shared Computers:</strong> If using a shared or
                  public computer, manually remove your API key before leaving (click "Remove" above).
                </div>
              </div>

              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 flex-shrink-0 text-amber-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <strong className="text-amber-200">Browser Extensions:</strong> Only install browser
                  extensions from trusted sources, as malicious extensions can access localStorage.
                </div>
              </div>

              <div className="flex items-start gap-2">
                <svg className="h-5 w-5 flex-shrink-0 text-red-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <strong className="text-amber-200">Never Share Your Key:</strong> Don't share your API
                  key in screenshots, screen recordings, or with others. Treat it like a password.
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3">
                <p className="text-xs text-amber-200">
                  <strong>Note:</strong> Your API key is only stored in your browser's localStorage and is
                  never sent to our servers. All API calls go directly from your browser to OpenAI.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecurityWarning;
