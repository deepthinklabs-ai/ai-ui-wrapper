"use client";

import React from "react";

type ChatHeaderProps = {
  currentThreadTitle: string | null;
};

const ChatHeader: React.FC<ChatHeaderProps> = ({ currentThreadTitle }) => {
  return (
    <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-950/95">
      <div className="flex flex-col">
        <span className="text-xs text-slate-500">Current thread</span>
        <span className="text-sm font-medium text-slate-50">
          {currentThreadTitle || "New thread"}
        </span>
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <span>Tokens: —</span>
        <span>Router: manual</span>
      </div>
    </header>
  );
};

export default ChatHeader;
