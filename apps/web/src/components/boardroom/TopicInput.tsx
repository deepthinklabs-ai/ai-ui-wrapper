/**
 * Topic Input Component
 *
 * Allows users to enter the topic or question that the LLM participants
 * will discuss in the Board Room.
 */

"use client";

import React from "react";

type TopicInputProps = {
  topic: string;
  onTopicChange: (topic: string) => void;
  onStart: () => void;
  isStarting: boolean;
  disabled: boolean;
};

export default function TopicInput({
  topic,
  onTopicChange,
  onStart,
  isStarting,
  disabled,
}: TopicInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      if (!disabled && topic.trim() && !isStarting) {
        onStart();
      }
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/50 p-6">
      <h2 className="text-lg font-semibold text-slate-100 mb-2">Discussion Topic</h2>
      <p className="text-sm text-slate-400 mb-4">
        What would you like the LLMs to discuss? Be specific for better results.
      </p>

      <textarea
        value={topic}
        onChange={(e) => onTopicChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="E.g., 'What are the key differences between React and Vue, and which is better for a large-scale enterprise application?'"
        className="w-full h-32 rounded-md border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-600 resize-none"
        disabled={isStarting}
      />

      <div className="mt-4 flex items-center justify-between">
        <div className="text-xs text-slate-500">
          Press <kbd className="rounded bg-slate-700 px-1.5 py-0.5">Ctrl</kbd> +{" "}
          <kbd className="rounded bg-slate-700 px-1.5 py-0.5">Enter</kbd> to start
        </div>
        <button
          onClick={onStart}
          disabled={disabled || !topic.trim() || isStarting}
          className="rounded-md bg-sky-600 px-6 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isStarting ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Starting Discussion...
            </span>
          ) : (
            "Start Discussion"
          )}
        </button>
      </div>

      {disabled && (
        <div className="mt-3 rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-xs text-amber-400">
          Please select at least 2 participants to start the discussion
        </div>
      )}
    </div>
  );
}
