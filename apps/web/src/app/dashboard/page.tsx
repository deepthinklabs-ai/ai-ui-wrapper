"use client";

import React, { useEffect, useState } from "react";
import { redirect } from "next/navigation";
import { useAuthSession } from "@/hooks/useAuthSession";
import { useThreads } from "@/hooks/useThreads";
import { useMessages } from "@/hooks/useMessages";
import Sidebar from "@/components/dashboard/Sidebar";
import ChatHeader from "@/components/dashboard/ChatHeader";
import MessageList from "@/components/dashboard/MessageList";
import MessageComposer from "@/components/dashboard/MessageComposer";

export default function DashboardPage() {
  const { user, loadingUser, error: userError, signOut } = useAuthSession();
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!loadingUser && !user) {
      redirect("/auth");
    }
  }, [loadingUser, user]);

  const {
    threads,
    loadingThreads,
    threadsError,
    selectedThreadId,
    selectThread,
    createThread,
  } = useThreads(user?.id);

  const {
    messages,
    loadingMessages,
    messagesError,
    sendInFlight,
    summarizeInFlight,
    sendMessage,
    summarizeThread,
  } = useMessages(selectedThreadId);

  const currentThread =
    threads.find((t) => t.id === selectedThreadId) ?? null;

  const handleSend = async () => {
    const content = draft.trim();
    if (!content || !selectedThreadId) return;
    await sendMessage(content);
    setDraft("");
  };

  const handleSummarize = async () => {
    if (!selectedThreadId) return;
    await summarizeThread();
  };

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
      {/* LEFT: sidebar column */}
      <aside className="w-64 h-screen flex-shrink-0 border-r border-slate-800 bg-slate-950">
        <Sidebar
          userEmail={user.email}
          threads={threads}
          selectedThreadId={selectedThreadId}
          onSelectThread={selectThread}
          onNewThread={createThread}
          onSignOut={signOut}
        />
      </aside>

      {/* RIGHT: chat column */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Centered chat area, like ChatGPT */}
        <div className="flex h-full w-full justify-center overflow-hidden">
          <div className="flex h-full w-full max-w-3xl flex-col gap-3 px-4 py-4 overflow-hidden">
            {/* Header at top of chat column */}
            <ChatHeader currentThreadTitle={currentThread?.title ?? null} />

            {(loadingThreads || threadsError || messagesError) && (
              <div className="rounded-md border border-slate-700 bg-slate-900/70 px-4 py-2 text-xs text-slate-300">
                {loadingThreads && <span>Loading threads… </span>}
                {threadsError && (
                  <span className="text-red-400">{threadsError} </span>
                )}
                {messagesError && (
                  <span className="text-red-400">{messagesError}</span>
                )}
              </div>
            )}

            {/* Chat card: messages + composer, very clearly separate from sidebar */}
            <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/70 shadow-lg">
              {/* Messages list (scrolls) */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <MessageList
                  messages={messages}
                  loading={loadingMessages}
                  thinking={sendInFlight || summarizeInFlight}
                />
              </div>

              {/* Composer stuck to bottom of card */}
              <div className="border-t border-slate-800 px-4 py-3">
                <MessageComposer
                  value={draft}
                  onChange={setDraft}
                  onSend={handleSend}
                  disabled={sendInFlight || !selectedThreadId}
                  onSummarize={handleSummarize}
                  canSummarize={!!selectedThreadId && messages.length > 0}
                  summarizing={summarizeInFlight}
                />
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
