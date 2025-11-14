/**
 * Conversation View Component
 *
 * Displays the Board Room conversation where LLMs discuss the topic,
 * respond to each other, agree/disagree, and collaborate.
 */

"use client";

import React, { useRef, useEffect } from "react";
import type { BoardRoomSession, BoardRoomMessage } from "@/types/boardroom";

type ConversationViewProps = {
  session: BoardRoomSession;
  isDiscussing: boolean;
};

export default function ConversationView({
  session,
  isDiscussing,
}: ConversationViewProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [session.messages.length]);

  const getParticipant = (participantId: string | null) => {
    if (!participantId) return null;
    return session.participants.find((p) => p.id === participantId);
  };

  const getSentimentIcon = (sentiment?: string) => {
    switch (sentiment) {
      case "agree":
        return (
          <svg className="h-4 w-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "disagree":
        return (
          <svg className="h-4 w-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        );
      case "question":
        return (
          <svg className="h-4 w-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900/50">
      {/* Header */}
      <div className="border-b border-slate-700 px-6 py-4 bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-100">Discussion in Progress</h3>
            <p className="text-sm text-slate-400 mt-1">
              <span className="font-medium">Topic:</span> {session.topic}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {session.participants.map((participant) => (
              <div
                key={participant.id}
                className="flex items-center gap-2 rounded-md bg-slate-800 px-3 py-1.5 border border-slate-700"
              >
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: participant.color }}
                />
                <span className="text-xs font-medium text-slate-300">{participant.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {session.messages.map((message) => {
          const participant = getParticipant(message.participantId);
          const isUserMessage = message.type === "user_prompt";

          return (
            <div
              key={message.id}
              className={`flex ${isUserMessage ? "justify-center" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-3 ${
                  isUserMessage
                    ? "bg-slate-700 border border-slate-600"
                    : "bg-slate-800 border border-slate-700"
                }`}
                style={
                  participant && !isUserMessage
                    ? { borderLeftWidth: "4px", borderLeftColor: participant.color }
                    : undefined
                }
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {participant && (
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: participant.color }}
                      />
                    )}
                    <span className="text-xs font-semibold text-slate-200">
                      {message.participantName}
                    </span>
                    {message.sentiment && getSentimentIcon(message.sentiment)}
                  </div>
                  <span className="text-xs text-slate-500">
                    {message.timestamp.toLocaleTimeString(undefined, {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Content */}
                <div className="text-sm text-slate-100 whitespace-pre-wrap">
                  {message.content}
                </div>
              </div>
            </div>
          );
        })}

        {/* Thinking indicator */}
        {isDiscussing && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-lg px-4 py-3 bg-slate-800 border border-slate-700">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-2 w-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="h-2 w-2 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                LLMs are discussing...
              </div>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>

      {/* Status bar */}
      <div className="border-t border-slate-700 px-6 py-3 bg-slate-800/50">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>{session.messages.length} messages</span>
          <span className="flex items-center gap-1">
            {session.status === "completed" ? (
              <>
                <svg className="h-4 w-4 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Discussion completed
              </>
            ) : (
              <>
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                Discussion in progress
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
