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
  onDeleteThread: (id: string) => Promise<void>;
  onSignOut: () => void;
};

export default function Sidebar({
  userEmail,
  threads,
  selectedThreadId,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onSignOut,
}: SidebarProps) {
  const handleDelete = (e: React.MouseEvent, threadId: string, threadTitle: string) => {
    e.stopPropagation(); // Prevent selecting the thread when clicking delete

    const confirmed = window.confirm(
      `Are you sure you want to delete "${threadTitle || 'New thread'}"?\n\nThis will permanently delete the thread and all its messages.`
    );

    if (confirmed) {
      onDeleteThread(threadId);
    }
  };
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
              <li key={thread.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelectThread(thread.id)}
                  className={`w-full rounded-md px-2 py-1.5 pr-8 text-left text-sm transition-colors ${
                    isActive
                      ? "bg-slate-800 text-slate-50"
                      : "text-slate-200 hover:bg-slate-900"
                  }`}
                >
                  <span className="block truncate">
                    {thread.title || "New thread"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, thread.id, thread.title || "New thread")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity rounded p-1 hover:bg-red-600/20 text-slate-400 hover:text-red-400"
                  title="Delete thread"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
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
