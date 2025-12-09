"use client";

import React from "react";

type ChatHeaderProps = {
  currentThreadTitle: string | null;
  onShowInfo?: () => void;
  hasThread?: boolean;
};

const ChatHeader: React.FC<ChatHeaderProps> = ({
  currentThreadTitle,
  onShowInfo,
  hasThread = false,
}) => {
  return (
    <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-950/95">
      <div className="flex items-center gap-2">
        <div className="flex flex-col">
          <span className="text-xs text-slate-500">Current .thread</span>
          <span className="text-sm font-medium text-slate-50">
            {currentThreadTitle || "Untitled"}<span className="text-slate-500">.thread</span>
          </span>
        </div>

        {/* Info button */}
        {hasThread && onShowInfo && (
          <button
            onClick={onShowInfo}
            className="ml-2 p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors"
            title="Thread Properties"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span>Tokens: —</span>
        <span>Router: manual</span>
      </div>
    </header>
  );
};

export default ChatHeader;
