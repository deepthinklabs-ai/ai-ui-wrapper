/**
 * Code Block Component
 *
 * Renders code blocks with syntax highlighting and a copy button.
 * Used within markdown rendering for AI responses.
 */

"use client";

import React, { useState } from "react";

type CodeBlockProps = {
  children: string;
  className?: string;
  inline?: boolean;
};

const CodeBlock: React.FC<CodeBlockProps> = ({ children, className, inline }) => {
  const [copied, setCopied] = useState(false);

  // Extract language from className (format: "language-python")
  const language = className?.replace(/language-/, "") || "text";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  // Inline code (single backticks) - render as simple code tag
  if (inline) {
    return (
      <code className="rounded bg-slate-800 px-1.5 py-0.5 text-xs font-mono text-purple-300">
        {children}
      </code>
    );
  }

  // Block code (triple backticks) - render with copy button
  return (
    <div className="group relative my-3 rounded-lg border border-slate-700 bg-slate-950">
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between border-b border-slate-700 bg-slate-900/50 px-4 py-2">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          {language}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-slate-300 hover:bg-slate-800 transition-colors"
          title={copied ? "Copied!" : "Copy code"}
        >
          {copied ? (
            <>
              <svg
                className="h-4 w-4 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              <span className="text-green-400">Copied!</span>
            </>
          ) : (
            <>
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <div className="overflow-x-auto">
        <pre className="p-4 text-sm leading-relaxed">
          <code className="font-mono text-slate-200">
            {children}
          </code>
        </pre>
      </div>
    </div>
  );
};

export default CodeBlock;
