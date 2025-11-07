"use client";

import React from "react";

type AppNavProps = {
  userEmail?: string | null;
};

const AppNav: React.FC<AppNavProps> = ({ userEmail }) => {
  return (
    <nav className="flex h-full w-14 flex-col border-r border-slate-800 bg-slate-950 text-slate-400">
      {/* Top: logo / app icon */}
      <div className="flex items-center justify-center border-b border-slate-800 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800 text-[10px] font-semibold text-slate-100">
          AI
        </div>
      </div>

      {/* Middle: main actions (like ChatGPT's +, Explore, etc.) */}
      <div className="flex-1 flex flex-col items-center gap-4 py-4 text-xl">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-800 hover:text-slate-100"
          title="New thread"
        >
          +
        </button>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-800 hover:text-slate-100"
          title="Search"
        >
          🔍
        </button>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-800 hover:text-slate-100"
          title="Projects"
        >
          📂
        </button>
      </div>

      {/* Bottom: user / settings */}
      <div className="flex flex-col items-center gap-3 border-t border-slate-800 py-3 text-xl">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-slate-100"
          title={userEmail ?? "Account"}
        >
          {/* Use first letter of email as avatar */}
          {(userEmail ?? "?").charAt(0).toUpperCase()}
        </button>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-slate-800 hover:text-slate-100 text-base"
          title="Settings"
        >
          ⚙️
        </button>
      </div>
    </nav>
  );
};

export default AppNav;
