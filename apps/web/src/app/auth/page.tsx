"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useApiKeyCleanup } from "@/hooks/useApiKeyCleanup";

type UserSummary = {
  id: string;
  email: string | null;
};

type Thread = {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string | null;
};

type Message = {
  id: string;
  thread_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model: string | null;
  created_at: string;
};

export default function DashboardPage() {
  const router = useRouter();

  // Auto-clear API key on logout for security
  useApiKeyCleanup();

  // auth
  const [loadingUser, setLoadingUser] = useState(true);
  const [user, setUser] = useState<UserSummary | null>(null);

  // threads
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);

  // messages
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  // ---------- load user + threads on mount ----------
  useEffect(() => {
    async function init() {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        console.error("Error getting session:", sessionError);
      }

      if (!session || !session.user) {
        router.replace("/auth");
        return;
      }

      const sessionUser = session.user;
      setUser({
        id: sessionUser.id,
        email: sessionUser.email ?? null,
      });
      setLoadingUser(false);

      // load threads
      setLoadingThreads(true);
      const { data: threadRows, error: threadsError } = await supabase
        .from("threads")
        .select("*")
        .order("updated_at", { ascending: false });

      if (threadsError) {
        console.error("Error loading threads:", threadsError);
        setLoadingThreads(false);
        return;
      }

      const list = (threadRows ?? []) as Thread[];
      setThreads(list);
      setLoadingThreads(false);

      // auto-select first thread if any
      if (list.length > 0) {
        setSelectedThreadId(list[0].id);
      }
    }

    init();
  }, [router]);

  // ---------- load messages when selectedThreadId changes ----------
  useEffect(() => {
    if (!selectedThreadId) {
      setMessages([]);
      return;
    }

    async function loadMessages() {
      setLoadingMessages(true);
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("thread_id", selectedThreadId)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error loading messages:", error);
        setLoadingMessages(false);
        return;
      }

      setMessages((data ?? []) as Message[]);
      setLoadingMessages(false);
    }

    loadMessages();
  }, [selectedThreadId]);

  // ---------- actions ----------

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/auth");
  }

  async function handleNewThread() {
    if (!user) {
      router.replace("/auth");
      return;
    }

    setCreatingThread(true);

    const { data, error } = await supabase
      .from("threads")
      .insert({
        user_id: user.id,
        title: "New thread",
      })
      .select("*")
      .single();

    setCreatingThread(false);

    if (error) {
      console.error("Error creating thread:", error);
      alert("Error creating thread: " + error.message);
      return;
    }

    if (data) {
      const newThread = data as Thread;
      setThreads((prev) => [newThread, ...prev]);
      setSelectedThreadId(newThread.id);
      setMessages([]);
    }
  }

  // 🔥 This is the updated function with OpenAI integration
  async function handleSend(e: FormEvent) {
    e.preventDefault();

    if (!selectedThreadId) {
      alert("Create or select a thread first.");
      return;
    }
    if (!input.trim()) return;

    const content = input.trim();
    setSending(true);

    // 1️⃣ Store user message in Supabase
    const { data: userMsg, error: insertError } = await supabase
      .from("messages")
      .insert({
        thread_id: selectedThreadId,
        role: "user",
        content,
        model: null,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("Error inserting user message:", insertError);
      alert("Error sending message: " + insertError.message);
      setSending(false);
      return;
    }

    const newUserMsg = userMsg as Message;
    setMessages((prev) => [...prev, newUserMsg]);
    setInput("");

    try {
      // 2️⃣ Build conversation for OpenAI (existing messages + new one)
      const convoForAI = [...messages, newUserMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      // 3️⃣ Call our Next.js API route which talks to OpenAI
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: convoForAI }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error("AI error:", data);
        alert("OpenAI error: " + data.error);
        return;
      }

      const reply = data.reply;

      // 4️⃣ Store assistant message in Supabase
      const { data: assistantMsg, error: insertAssistantErr } = await supabase
        .from("messages")
        .insert({
          thread_id: selectedThreadId,
          role: reply.role ?? "assistant",
          content:
            typeof reply.content === "string"
              ? reply.content
              : Array.isArray(reply.content)
              ? reply.content.map((c: any) => c.text ?? "").join("\n")
              : reply.content ?? "(empty reply)",
          model: reply.model ?? "gpt-4o-mini",
        })
        .select("*")
        .single();

      if (insertAssistantErr) {
        console.error(
          "Error saving assistant message:",
          insertAssistantErr
        );
        alert(
          "Error saving assistant message: " + insertAssistantErr.message
        );
        return;
      }

      // 5️⃣ Show assistant message in chat
      const newAssistantMsg = assistantMsg as Message;
      setMessages((prev) => [...prev, newAssistantMsg]);
    } catch (err: any) {
      console.error("Error calling AI API:", err);
      alert("AI request failed: " + err.message);
    } finally {
      setSending(false);
    }
  }

  if (loadingUser) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white">
        <p>Checking session…</p>
      </main>
    );
  }

  const selectedThread = threads.find((t) => t.id === selectedThreadId) || null;

  return (
    <main className="min-h-screen bg-black text-white flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-neutral-800 flex flex-col">
        <div className="px-4 py-3 border-b border-neutral-800">
          <h1 className="text-lg font-semibold">AI UI Wrapper</h1>
          <p className="text-xs text-neutral-400">
            {user?.email ?? "Unknown user"}
          </p>
        </div>

        <div className="px-3 py-2">
          <button
            onClick={handleNewThread}
            disabled={creatingThread}
            className="w-full text-sm rounded-md px-3 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-60"
          >
            {creatingThread ? "Creating…" : "+ New Thread"}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2 text-sm">
          <p className="text-neutral-500 text-xs mt-2">Recent threads</p>

          {loadingThreads && (
            <div className="text-neutral-500 text-xs">Loading threads…</div>
          )}

          {!loadingThreads && threads.length === 0 && (
            <div className="rounded-md border border-neutral-800 px-3 py-2 text-neutral-300 text-sm">
              No threads yet. Start a new one.
            </div>
          )}

          {!loadingThreads &&
            threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() => setSelectedThreadId(thread.id)}
                className={`w-full text-left rounded-md border border-neutral-800 px-3 py-2 hover:bg-neutral-900 ${
                  thread.id === selectedThreadId ? "bg-neutral-900" : ""
                }`}
              >
                <div className="text-sm">
                  {thread.title || "Untitled thread"}
                </div>
                <div className="text-[10px] text-neutral-500">
                  {new Date(thread.created_at).toLocaleString()}
                </div>
              </button>
            ))}
        </div>

        <div className="px-3 py-3 border-t border-neutral-800 text-xs flex items-center justify-between">
          <span className="text-neutral-500">v0.0.1</span>
          <button
            onClick={handleSignOut}
            className="text-neutral-400 hover:text-red-400"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <section className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="h-12 border-b border-neutral-800 flex items-center justify-between px-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-neutral-400">Current thread:</span>
            <span className="font-mono text-neutral-100">
              {selectedThread
                ? selectedThread.title || "Untitled thread"
                : "None"}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-neutral-400">
            <span>Tokens: —</span>
            <span>Router: manual</span>
          </div>
        </header>

        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 text-sm">
            {!selectedThread && (
              <div className="text-neutral-500">
                Create or select a thread to start chatting.
              </div>
            )}

            {selectedThread && loadingMessages && (
              <div className="text-neutral-500 text-xs">
                Loading messages…
              </div>
            )}

            {selectedThread &&
              !loadingMessages &&
              messages.length === 0 && (
                <div className="text-neutral-500">
                  No messages yet. Start typing below to talk to your selected
                  LLM.
                </div>
              )}

            {selectedThread &&
              !loadingMessages &&
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`max-w-xl rounded-lg px-3 py-2 border border-neutral-800 ${
                    msg.role === "user"
                      ? "self-end bg-neutral-900"
                      : "self-start bg-neutral-950"
                  }`}
                >
                  <div className="text-[10px] text-neutral-500 mb-1">
                    {msg.role === "user" ? "You" : "Assistant"} •{" "}
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </div>
                  <div className="whitespace-pre-wrap text-sm">
                    {msg.content}
                  </div>
                </div>
              ))}
          </div>

          {/* Input area */}
          <form
            className="border-t border-neutral-800 px-4 py-3 flex flex-col gap-2"
            onSubmit={handleSend}
          >
            <textarea
              rows={3}
              className="w-full resize-none rounded-md bg-neutral-900 border border-neutral-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              placeholder={
                selectedThread
                  ? "Type a prompt…"
                  : "Create or select a thread first…"
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!selectedThread || sending}
            />
            <div className="flex items-center justify-between text-xs text-neutral-500">
              <div className="flex gap-3">
                <button
                  type="button"
                  className="hover:text-neutral-300"
                  disabled
                >
                  Prompt templates
                </button>
                <button
                  type="button"
                  className="hover:text-neutral-300"
                  disabled
                >
                  Routing
                </button>
              </div>
              <button
                type="submit"
                className="rounded-md bg-sky-600 hover:bg-sky-500 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                disabled={!selectedThread || sending || !input.trim()}
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
