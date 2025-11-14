/**
 * Terminal Bot Command Page
 *
 * A GUI wrapper for CLI-based AI tools like Claude Code.
 * Makes terminal-based AI accessible to non-technical users with
 * features like file uploads, image support, and an intuitive interface.
 */

"use client";

import React, { useEffect } from "react";
import { redirect } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useUserTier } from "@/hooks/useUserTier";
import Sidebar from "@/components/dashboard/Sidebar";
import { useThreads } from "@/hooks/useThreads";
import TerminalPanel from "@/components/terminal/TerminalPanel";

export default function TerminalBotPage() {
  const { user, loadingUser, error: userError, signOut } = useAuthSession();
  const { tier } = useUserTier(user?.id);

  // Use the same threads hook for sidebar consistency
  const {
    threads,
    loadingThreads,
    threadsError,
    selectedThreadId,
    selectThread,
    createThread,
    deleteThread,
    updateThreadTitle,
    canCreateThread,
    threadLimitReached,
  } = useThreads(user?.id);

  useEffect(() => {
    if (!loadingUser && !user) {
      redirect("/auth");
    }
  }, [loadingUser, user]);

  if (loadingUser) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-200">
        Loading…
      </div>
    );
  }

  if (userError) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-red-400">
        Error: {userError}
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-row h-screen bg-slate-950 text-slate-50">
      {/* LEFT: sidebar */}
      <aside className="w-64 h-screen flex-shrink-0 border-r border-slate-800 bg-slate-950">
        <Sidebar
          userEmail={user.email}
          threads={threads}
          selectedThreadId={selectedThreadId}
          onSelectThread={selectThread}
          onNewThread={createThread}
          onDeleteThread={deleteThread}
          onUpdateThreadTitle={updateThreadTitle}
          onSignOut={signOut}
          canCreateThread={canCreateThread}
          threadLimitReached={threadLimitReached}
          maxThreads={tier === "pro" ? Infinity : 5}
          userTier={tier}
        />
      </aside>

      {/* RIGHT: Terminal Bot panel */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <TerminalPanel userId={user.id} userTier={tier} />
      </main>
    </div>
  );
}
