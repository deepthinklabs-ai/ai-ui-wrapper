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
  onUpdateThreadTitle: (id: string, newTitle: string) => Promise<void>;
  onSignOut: () => void;
  canCreateThread?: boolean;
  threadLimitReached?: boolean;
  maxThreads?: number;
  userTier?: "free" | "pro";
};

export default function Sidebar({
  userEmail,
  threads,
  selectedThreadId,
  onSelectThread,
  onNewThread,
  onDeleteThread,
  onUpdateThreadTitle,
  onSignOut,
  canCreateThread = true,
  threadLimitReached = false,
  maxThreads = 5,
  userTier = "free",
}: SidebarProps) {
  const router = useRouter();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editedTitle, setEditedTitle] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

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

  // Focus input when entering edit mode
  useEffect(() => {
    if (editingThreadId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingThreadId]);

  const handleDelete = (e: React.MouseEvent, threadId: string, threadTitle: string) => {
    e.stopPropagation(); // Prevent selecting the thread when clicking delete

    const confirmed = window.confirm(
      `Are you sure you want to delete "${threadTitle || 'New thread'}"?\n\nThis will permanently delete the thread and all its messages.`
    );

    if (confirmed) {
      onDeleteThread(threadId);
    }
  };

  const startEditing = (e: React.MouseEvent, threadId: string, currentTitle: string) => {
    e.stopPropagation(); // Prevent selecting the thread when clicking edit
    setEditingThreadId(threadId);
    setEditedTitle(currentTitle || "New thread");
  };

  const cancelEditing = () => {
    setEditingThreadId(null);
    setEditedTitle("");
  };

  const saveTitle = async (threadId: string) => {
    const trimmedTitle = editedTitle.trim();
    if (!trimmedTitle) {
      cancelEditing();
      return;
    }

    await onUpdateThreadTitle(threadId, trimmedTitle);
    cancelEditing();
  };

  const handleKeyDown = (e: React.KeyboardEvent, threadId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveTitle(threadId);
    } else if (e.key === "Escape") {
      cancelEditing();
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
            <div className="flex items-center gap-2 truncate">
              <span className="truncate">{userEmail ?? "Signed in"}</span>
              {userTier === "pro" ? (
                <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
                  Pro
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-slate-500/10 px-2 py-0.5 text-xs font-medium text-slate-400 ring-1 ring-inset ring-slate-500/20">
                  Free
                </span>
              )}
            </div>
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
          disabled={!canCreateThread}
          className={`mt-3 w-full rounded-md border px-2 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-950 ${
            canCreateThread
              ? "border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800"
              : "border-slate-800 bg-slate-900/50 text-slate-500 cursor-not-allowed"
          }`}
          title={!canCreateThread ? `Free tier limit: ${maxThreads} threads max` : ""}
        >
          + New thread
        </button>

        {/* Thread limit warning */}
        {threadLimitReached && (
          <div className="mt-2 rounded-md bg-amber-500/10 border border-amber-500/20 px-2 py-2 text-xs text-amber-400">
            <div className="font-semibold mb-1">Thread Limit Reached</div>
            <div className="text-amber-400/80">
              Free tier: {threads.length}/{maxThreads} threads. Delete a thread or{" "}
              <button
                onClick={() => router.push("/settings")}
                className="underline hover:text-amber-300"
              >
                upgrade to Pro
              </button>{" "}
              for unlimited threads.
            </div>
          </div>
        )}
      </div>

      {/* Navigation: AI Agent, Board Room & Terminal Bot */}
      <div className="border-b border-slate-800 px-3 py-3">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
              />
            </svg>
            AI Agent
          </button>
          <button
            type="button"
            onClick={() => router.push("/cablebox")}
            className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            The Cable Box
          </button>
          <button
            type="button"
            onClick={() => router.push("/workforce")}
            className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
              />
            </svg>
            The Workforce
          </button>
          <button
            type="button"
            onClick={() => router.push("/canvas")}
            className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z"
              />
            </svg>
            Canvas
          </button>
        </div>
      </div>

      {/* Middle: threads list */}
      <div className="flex-1 overflow-y-auto px-2 py-3">
        <div className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
          AI Agent Threads
        </div>
        {threads.length === 0 && (
          <div className="px-2 py-1 text-xs text-slate-500">
            No threads yet. Create one to get started.
          </div>
        )}
        <ul className="space-y-1">
          {threads.map((thread) => {
            const isActive = thread.id === selectedThreadId;
            const isEditing = editingThreadId === thread.id;

            return (
              <li key={thread.id} className="group relative">
                {isEditing ? (
                  <div className="flex items-center gap-1 px-2 py-1.5">
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, thread.id)}
                      onBlur={() => saveTitle(thread.id)}
                      className="flex-1 rounded border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-100 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                    />
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onSelectThread(thread.id)}
                      className={`w-full rounded-md px-2 py-1.5 pr-16 text-left text-sm transition-colors ${
                        isActive
                          ? "bg-slate-800 text-slate-50"
                          : "text-slate-200 hover:bg-slate-900"
                      }`}
                    >
                      <span className="block truncate">
                        {thread.title || "New thread"}
                      </span>
                    </button>
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => startEditing(e, thread.id, thread.title || "New thread")}
                        className="rounded p-1 hover:bg-blue-600/20 text-slate-400 hover:text-blue-400"
                        title="Edit thread name"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                        >
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(e, thread.id, thread.title || "New thread")}
                        className="rounded p-1 hover:bg-red-600/20 text-slate-400 hover:text-red-400"
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
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>

    </div>
  );
}
