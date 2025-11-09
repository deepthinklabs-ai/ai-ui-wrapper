"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isUserMenuOpen]);

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

        {/* User Menu Button */}
        <div className="relative mt-1" ref={menuRef}>
          <button
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="w-full flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-slate-200 hover:bg-slate-900 transition-colors"
          >
            <span className="truncate">{userEmail ?? "Signed in"}</span>
            <svg
              className={`h-4 w-4 flex-shrink-0 transition-transform ${isUserMenuOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown Menu */}
          {isUserMenuOpen && (
            <div className="absolute left-0 right-0 mt-1 rounded-md border border-slate-700 bg-slate-800 shadow-lg z-10">
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  router.push("/settings");
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors rounded-t-md"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                Settings
              </button>
              <button
                onClick={() => {
                  setIsUserMenuOpen(false);
                  onSignOut();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-200 hover:bg-slate-700 transition-colors rounded-b-md"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                Sign Out
              </button>
            </div>
          )}
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

    </div>
  );
}
