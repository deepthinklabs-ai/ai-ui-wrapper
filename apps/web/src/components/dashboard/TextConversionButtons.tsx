/**
 * Text Conversion Buttons Component
 *
 * Displays buttons to convert draft text to Markdown or JSON format
 * before sending. Only enabled when there's text to convert.
 */

"use client";

import React from "react";

type TextConversionButtonsProps = {
  hasText: boolean;
  convertingToMarkdown: boolean;
  convertingToJson: boolean;
  onConvertToMarkdown: () => void;
  onConvertToJson: () => void;
  disabled?: boolean;
  showMarkdownButton?: boolean;
  showJsonButton?: boolean;
};

const TextConversionButtons: React.FC<TextConversionButtonsProps> = ({
  hasText,
  convertingToMarkdown,
  convertingToJson,
  onConvertToMarkdown,
  onConvertToJson,
  disabled = false,
  showMarkdownButton = true,
  showJsonButton = true,
}) => {
  const isDisabled = disabled || !hasText;

  // Don't render anything if both buttons are hidden
  if (!showMarkdownButton && !showJsonButton) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 font-medium">Convert Draft To:</span>

      {/* Convert to Markdown - only show if enabled */}
      {showMarkdownButton && (
        <button
        onClick={onConvertToMarkdown}
        disabled={isDisabled || convertingToMarkdown}
        className="flex items-center gap-1.5 rounded-md border border-blue-600 bg-blue-600/10 px-3 py-1 text-[11px] text-blue-400 hover:bg-blue-600/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
        title="Convert your text to Markdown format"
      >
        {convertingToMarkdown ? (
          <>
            <svg
              className="animate-spin h-3 w-3"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Converting...
          </>
        ) : (
          <>
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            Markdown
          </>
        )}
        </button>
      )}

      {/* Convert to JSON - only show if enabled */}
      {showJsonButton && (
        <button
        onClick={onConvertToJson}
        disabled={isDisabled || convertingToJson}
        className="flex items-center gap-1.5 rounded-md border border-teal-600 bg-teal-600/10 px-3 py-1 text-[11px] text-teal-400 hover:bg-teal-600/20 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
        title="Convert your text to JSON format"
      >
        {convertingToJson ? (
          <>
            <svg
              className="animate-spin h-3 w-3"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Converting...
          </>
        ) : (
          <>
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            JSON
          </>
        )}
        </button>
      )}
    </div>
  );
};

export default TextConversionButtons;
