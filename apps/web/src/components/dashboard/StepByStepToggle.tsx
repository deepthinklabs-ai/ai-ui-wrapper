/**
 * Step-by-Step Toggle Component
 *
 * Provides toggle buttons for step-by-step response modes.
 * Allows users to enable one-step-at-a-time responses with or without explanations.
 */

"use client";

import React from "react";

type StepByStepToggleProps = {
  isWithExplanationEnabled: boolean;
  isNoExplanationEnabled: boolean;
  onToggleWithExplanation: () => void;
  onToggleNoExplanation: () => void;
  disabled?: boolean;
};

const StepByStepToggle: React.FC<StepByStepToggleProps> = ({
  isWithExplanationEnabled,
  isNoExplanationEnabled,
  onToggleWithExplanation,
  onToggleNoExplanation,
  disabled = false,
}) => {
  return (
    <div className="flex items-center gap-2 mb-2">
      <span className="text-xs text-slate-400 font-medium">Step Mode:</span>

      {/* Step-by-Step WITH Explanation Toggle */}
      <button
        onClick={onToggleWithExplanation}
        disabled={disabled}
        className={`group relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          isWithExplanationEnabled
            ? "bg-blue-600 text-white shadow-md"
            : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
        }`}
        title="Toggle step-by-step mode with detailed explanations"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
          />
        </svg>
        <span>1 Step + Explain</span>
        {isWithExplanationEnabled && (
          <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-400 animate-pulse" />
        )}
      </button>

      {/* Step-by-Step NO Explanation Toggle */}
      <button
        onClick={onToggleNoExplanation}
        disabled={disabled}
        className={`group relative flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
          isNoExplanationEnabled
            ? "bg-purple-600 text-white shadow-md"
            : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
        }`}
        title="Toggle step-by-step mode with no explanations (just the step)"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 10V3L4 14h7v7l9-11h-7z"
          />
        </svg>
        <span>1 Step Only</span>
        {isNoExplanationEnabled && (
          <div className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-green-400 animate-pulse" />
        )}
      </button>

      {/* Active indicator text */}
      {(isWithExplanationEnabled || isNoExplanationEnabled) && (
        <span className="text-xs text-green-400 font-medium flex items-center gap-1">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          Active
        </span>
      )}
    </div>
  );
};

export default StepByStepToggle;
