/**
 * API Key Input Component
 *
 * Allows users to enter and test their OpenAI API key.
 * Includes validation and test connection functionality.
 */

"use client";

import React, { useState } from "react";

type ApiKeyInputProps = {
  value: string;
  onChange: (value: string) => void;
  onTest: () => Promise<boolean>;
  isTesting: boolean;
};

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({
  value,
  onChange,
  onTest,
  isTesting,
}) => {
  const [showKey, setShowKey] = useState(false);
  const [testResult, setTestResult] = useState<"success" | "error" | null>(null);

  const handleTest = async () => {
    setTestResult(null);
    const success = await onTest();
    setTestResult(success ? "success" : "error");

    // Clear test result after 3 seconds
    setTimeout(() => setTestResult(null), 3000);
  };

  // OpenAI keys start with "sk-", Claude keys start with "sk-ant-"
  const isValidFormat = (value.startsWith("sk-") || value.startsWith("sk-ant-")) && value.length > 20;

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type={showKey ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="sk-..."
          className="w-full rounded-md border border-slate-700 bg-slate-800 px-4 py-3 pr-24 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <button
          type="button"
          onClick={() => setShowKey(!showKey)}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
        >
          {showKey ? "Hide" : "Show"}
        </button>
      </div>

      {value && !isValidFormat && (
        <div className="flex items-center gap-2 text-xs text-amber-400">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>API key should start with 'sk-' (OpenAI) or 'sk-ant-' (Claude)</span>
        </div>
      )}

      <button
        onClick={handleTest}
        disabled={!value || !isValidFormat || isTesting}
        className="w-full rounded-md bg-purple-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
      >
        {isTesting ? (
          <>
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            Testing Connection...
          </>
        ) : (
          <>
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Test Connection
          </>
        )}
      </button>

      {testResult === "success" && (
        <div className="flex items-center gap-2 rounded-md bg-green-500/10 border border-green-500/20 px-4 py-2.5 text-sm text-green-400">
          <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          <span>API key is valid! Connection successful.</span>
        </div>
      )}

      {testResult === "error" && (
        <div className="flex items-center gap-2 rounded-md bg-red-500/10 border border-red-500/20 px-4 py-2.5 text-sm text-red-400">
          <svg className="h-5 w-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
          <span>Invalid API key. Please check and try again.</span>
        </div>
      )}
    </div>
  );
};

export default ApiKeyInput;
