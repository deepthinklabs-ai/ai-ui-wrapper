"use client";

import React from "react";

type AppNavProps = {
  userEmail?: string | null;
};

const AppNav: React.FC<AppNavProps> = ({ userEmail }) => {
  return (
    <nav className="flex h-full w-14 flex-col border-r border-white/40 bg-white/40 backdrop-blur-md text-foreground-secondary/70">
      {/* Top: logo / app icon */}
      <div className="flex items-center justify-center border-b border-white/30 py-3">
        <img
          src="/logo.png"
          alt="aiuiw"
          className="h-8 w-8 rounded-lg object-cover brightness-90"
        />
      </div>

      {/* Middle: main actions (like ChatGPT's +, Explore, etc.) */}
      <div className="flex-1 flex flex-col items-center gap-4 py-4 text-xl">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/40 hover:text-foreground transition-colors"
          title="New thread"
        >
          +
        </button>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/40 hover:text-foreground transition-colors"
          title="Search"
        >
          🔍
        </button>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/40 hover:text-foreground transition-colors"
          title="Projects"
        >
          📂
        </button>
      </div>

      {/* Bottom: user / settings */}
      <div className="flex flex-col items-center gap-3 border-t border-white/30 py-3 text-xl">
        <button
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/60 text-xs font-semibold text-foreground shadow-sm"
          title={userEmail ?? "Account"}
        >
          {/* Use first letter of email as avatar */}
          {(userEmail ?? "?").charAt(0).toUpperCase()}
        </button>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-white/40 hover:text-foreground text-base transition-colors"
          title="Settings"
        >
          ⚙️
        </button>
      </div>
    </nav>
  );
};

export default AppNav;
