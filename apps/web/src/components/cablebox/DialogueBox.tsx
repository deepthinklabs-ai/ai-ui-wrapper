/**
 * Dialogue Box Component
 *
 * Displays conversation history between AI characters.
 */

"use client";

import React, { useEffect, useRef } from "react";
import type { DialogueMessage, Character } from "@/types/cablebox";

type DialogueBoxProps = {
  dialogueHistory: DialogueMessage[];
  characters: Character[];
  onClearDialogue: () => void;
};

export default function DialogueBox({
  dialogueHistory,
  characters,
  onClearDialogue,
}: DialogueBoxProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [dialogueHistory]);

  // Get character color by ID
  const getCharacterColor = (characterId: string): string => {
    const character = characters.find((c) => c.id === characterId);
    return character?.color || "#888888";
  };

  return (
    <div className="flex flex-col h-full rounded-lg border border-slate-700 bg-slate-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3">
        <div className="flex items-center gap-2">
          <svg className="h-5 w-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="text-sm font-semibold text-slate-200">Transcript</h3>
          {dialogueHistory.length > 0 && (
            <span className="text-xs text-slate-500">({dialogueHistory.length})</span>
          )}
        </div>
        {dialogueHistory.length > 0 && (
          <button
            onClick={onClearDialogue}
            className="text-xs text-slate-400 hover:text-red-400 transition-colors"
            title="Clear dialogue history"
          >
            Clear
          </button>
        )}
      </div>

      {/* Dialogue Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
      >
        {dialogueHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg
              className="h-12 w-12 text-slate-600 mb-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p className="text-sm text-slate-400">
              No dialogue yet. Press Play to start the show!
            </p>
          </div>
        ) : (
          dialogueHistory.map((message) => {
            const characterColor = getCharacterColor(message.characterId);

            return (
              <div key={message.id} className="flex gap-3">
                {/* Character indicator dot */}
                <div className="flex-shrink-0 mt-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: characterColor }}
                    title={message.characterName}
                  />
                </div>

                {/* Message content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: characterColor }}
                    >
                      {message.characterName}
                    </span>
                    <span className="text-xs text-slate-500">
                      {message.timestamp.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    {message.isReaction && (
                      <span className="text-xs text-purple-400" title="Reaction">
                        ↪
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {message.text}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
