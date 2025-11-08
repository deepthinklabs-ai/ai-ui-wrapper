/**
 * Text Selection Popup Component
 *
 * Displays a floating button when text is selected, allowing users to
 * add the selected text as context to a side panel for isolated questions.
 */

"use client";

import React from "react";

type TextSelectionPopupProps = {
  x: number;
  y: number;
  onAddContext: () => void;
};

const TextSelectionPopup: React.FC<TextSelectionPopupProps> = ({
  x,
  y,
  onAddContext,
}) => {
  return (
    <div
      className="fixed z-50 animate-in fade-in zoom-in duration-150"
      style={{
        left: `${x}px`,
        top: `${y}px`,
        transform: "translate(-50%, -100%)",
      }}
    >
      <button
        onClick={onAddContext}
        className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:from-purple-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-950 transition-all"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
          <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
        </svg>
        Add as context
      </button>
    </div>
  );
};

export default TextSelectionPopup;
