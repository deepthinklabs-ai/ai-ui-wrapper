"use client";

import React from "react";

type Thread = {
  id: string;
  title: string | null;
  created_at?: string;
};

type SidebarProps = {
  userEmail: string | null | undefined;
  threads: Thread[];
  selectedThreadId: string | null;
  onSelectThread: (id: string) => void;
  onNewThread: () => void;
  onSignOut: () => void;
};

export default function Sidebar({
  userEmail,
  threads,
  selectedThreadId,
  onSelectThread,
  onNewThread,
  onSignOut,
}: SidebarProps) {
  return (
    <div className="flex h-full flex-col bg-slate-950 text-slate-100">
      {/* Top: app + user info + new thread */}
      <div className="border-b border-slate-800 px-3 py-4">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          AI UI Wrapper
        </div>
        <div className="mt-1 truncate text-sm text-slate-200">
          {userEmail ?? "Signed in"}
        </div>

        <button
          type="button"
          onClick={onNewThread}
          className="mt-3 w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm font-medium text-slate-100 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          + New thread
        </button>
      </div>

      {/* Middle: threads list */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Threads
        </div>
        {threads.length === 0 && (
          <div className="px-2 py-1 text-xs text-slate-500">
            No threads yet. Create one to get started.
          </div>
        )}
        <ul className="space-y-1">
          {threads.map((thread) => {
            const isActive = thread.id === selectedThreadId;
            return (
              <li key={thread.id}>
                <button
                  type="button"
                  onClick={() => onSelectThread(thread.id)}
                  className={`w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-slate-800 text-slate-50"
                      : "text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <span className="block truncate">
                    {thread.title || "New thread"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Bottom: sign out */}
      <div className="border-t border-slate-800 px-3 py-3">
        <button
          type="button"
          onClick={onSignOut}
          className="w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-950"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
