"use client";

import React from "react";
import type { Chatbot } from "@/types/chatbot";

type ChatHeaderProps = {
  currentThreadTitle: string | null;
  onShowInfo?: () => void;
  hasThread?: boolean;
  /** The active chatbot for this thread */
  activeChatbot?: Chatbot | null;
  /** Called when edit chatbot button is clicked */
  onEditChatbot?: () => void;
  /** Whether chatbot settings are currently being edited */
  isEditingChatbot?: boolean;
};

const ChatHeader: React.FC<ChatHeaderProps> = ({
  currentThreadTitle,
  onShowInfo,
  hasThread = false,
  activeChatbot,
  onEditChatbot,
  isEditingChatbot = false,
}) => {
  // Get provider color for chatbot indicator
  const provider = activeChatbot?.config?.model?.provider || "ai";
  const providerColors: Record<string, string> = {
    openai: "bg-green-500",
    claude: "bg-orange-500",
    grok: "bg-blue-500",
    gemini: "bg-purple-500",
  };
  const dotColor = providerColors[provider] || "bg-slate-500";

  return (
    <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-950/95">
      <div className="flex items-center gap-4">
        {/* Thread info */}
        <div className="flex items-center gap-2">
          <div className="flex flex-col">
            <span className="text-xs text-slate-500">Current .thread</span>
            <span className="text-sm font-medium text-slate-50">
              {currentThreadTitle || "Untitled"}<span className="text-slate-500">.thread</span>
            </span>
          </div>

          {/* Info button */}
          {hasThread && onShowInfo && (
            <button
              onClick={onShowInfo}
              className="ml-2 p-1.5 text-slate-500 hover:text-blue-400 hover:bg-slate-800 rounded transition-colors"
              title="Thread Properties"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Divider */}
        {activeChatbot && (
          <div className="h-8 w-px bg-slate-700" />
        )}

        {/* Chatbot info */}
        {activeChatbot && (
          <div className="flex items-center gap-2">
            <div className="flex flex-col">
              <span className="text-xs text-slate-500">Using .chatbot</span>
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${dotColor}`} />
                <span className="text-sm font-medium text-slate-50">
                  {activeChatbot.name}<span className="text-slate-500">.chatbot</span>
                </span>
              </div>
            </div>

            {/* Edit chatbot button */}
            {onEditChatbot && (
              <button
                onClick={onEditChatbot}
                disabled={isEditingChatbot}
                className={`ml-2 p-1.5 rounded transition-colors ${
                  isEditingChatbot
                    ? "text-cyan-400 bg-cyan-500/20 cursor-not-allowed"
                    : "text-slate-500 hover:text-yellow-400 hover:bg-slate-800"
                }`}
                title={isEditingChatbot ? "Currently editing..." : "Edit chatbot settings"}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
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
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 text-xs text-slate-400">
        {activeChatbot?.config?.model?.model_name && (
          <span className="text-slate-300">{activeChatbot.config.model.model_name}</span>
        )}
        <span>Tokens: —</span>
        <span>Router: manual</span>
      </div>
    </header>
  );
};

export default ChatHeader;
