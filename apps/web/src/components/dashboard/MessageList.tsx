"use client";

import React, { useEffect, useRef } from "react";
import type { Message } from "@/types/chat";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MessageListProps = {
  messages: Message[];
  loading: boolean;
  thinking: boolean; // 👈 NEW
};

function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

const MessageList: React.FC<MessageListProps> = ({
  messages,
  loading,
  thinking,
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom whenever messages change or thinking state toggles
  useEffect(() => {
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, thinking]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-slate-950">
      {loading && (
        <div className="text-xs text-slate-500">Loading messages…</div>
      )}

      {messages.map((m) => {
        const isUser = m.role === "user";
        const isSummary = m.content.startsWith("**Thread summary**");
        const label = isUser
          ? "You"
          : isSummary
          ? "Summary"
          : m.role === "assistant"
          ? "Assistant"
          : "System";

        const timestamp = formatTimestamp(m.created_at);

        return (
          <div
            key={m.id}
            className={`flex w-full ${
              isUser ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[70%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                isUser
                  ? "bg-sky-600 text-white"
                  : isSummary
                  ? "bg-emerald-900/60 text-emerald-50 border border-emerald-700/70"
                  : "bg-slate-900 text-slate-100 border border-slate-800"
              }`}
            >
              <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-wide opacity-70">
                <span>{label}</span>
                {timestamp && (
                  <span className="ml-2 normal-case text-[10px] opacity-75">
                    {timestamp}
                  </span>
                )}
              </div>

              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {m.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        );
      })}

      {/* Typing / thinking indicator */}
      {thinking && (
        <div className="flex w-full justify-start">
          <div className="max-w-[50%] rounded-lg px-3 py-2 text-sm bg-slate-900 text-slate-100 border border-slate-800">
            <div className="mb-1 text-[10px] uppercase tracking-wide opacity-70">
              Assistant
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="h-2 w-2 rounded-full bg-slate-500 animate-pulse" />
              <span className="animate-pulse">Thinking…</span>
            </div>
          </div>
        </div>
      )}

      {!loading && messages.length === 0 && !thinking && (
        <div className="text-xs text-slate-500">
          Start the conversation by sending a message.
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
