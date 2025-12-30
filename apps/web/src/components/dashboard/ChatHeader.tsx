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
  const dotColor = providerColors[provider] || "bg-foreground/50";

  return (
    <header className="flex items-center justify-between border-b border-white/30 px-4 py-3">
      <div className="flex items-center gap-4">
        {/* Thread name only */}
        <span className="text-sm font-medium text-foreground">
          {currentThreadTitle || "Untitled"}<span className="text-foreground/50">.thread</span>
        </span>

        {/* Chatbot info - show if active */}
        {activeChatbot && (
          <>
            <div className="h-4 w-px bg-white/30" />
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${dotColor}`} />
              <span className="text-sm text-foreground">
                {activeChatbot.name}<span className="text-foreground/50">.chatbot</span>
              </span>
              {/* Edit chatbot button */}
              {onEditChatbot && (
                <button
                  onClick={onEditChatbot}
                  disabled={isEditingChatbot}
                  className={`ml-1 p-1 rounded transition-colors ${
                    isEditingChatbot
                      ? "text-sky bg-sky/20 cursor-not-allowed"
                      : "text-foreground/40 hover:text-foreground hover:bg-white/40"
                  }`}
                  title={isEditingChatbot ? "Currently editing..." : "Edit chatbot settings"}
                >
                  <svg
                    className="w-3.5 h-3.5"
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
          </>
        )}
      </div>
    </header>
  );
};

export default ChatHeader;
