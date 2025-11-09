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
  isContextPanelOpen?: boolean;
};

const TextSelectionPopup: React.FC<TextSelectionPopupProps> = ({
  x,
  y,
  onAddContext,
  isContextPanelOpen = false,
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
        className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-slate-950 transition-all ${
          isContextPanelOpen
            ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500"
            : "bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
        }`}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          {isContextPanelOpen ? (
            <>
              <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" />
            </>
          ) : (
            <>
              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
            </>
          )}
        </svg>
        {isContextPanelOpen
          ? "Ask a Question About This As Well?"
          : "Ask a Question About This?"}
      </button>
    </div>
  );
};

export default TextSelectionPopup;
