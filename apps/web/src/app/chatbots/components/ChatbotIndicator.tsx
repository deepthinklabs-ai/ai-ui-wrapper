"use client";

/**
 * ChatbotIndicator Component
 *
 * Shows which chatbot configuration is active for the current thread.
 * Displays in the chat header area.
 */

import React from "react";
import type { Chatbot } from "@/types/chatbot";

type ChatbotIndicatorProps = {
  /** The active chatbot for the current thread */
  chatbot: Chatbot | null;
  /** Called when the user wants to change the chatbot */
  onChangeChatbot?: () => void;
  /** Whether the indicator is clickable */
  clickable?: boolean;
  /** Compact mode */
  compact?: boolean;
  /** Additional class names */
  className?: string;
};

export function ChatbotIndicator({
  chatbot,
  onChangeChatbot,
  clickable = true,
  compact = false,
  className = "",
}: ChatbotIndicatorProps) {
  if (!chatbot) {
    // Not using a chatbot config - show nothing or minimal indicator
    return null;
  }

  const provider = chatbot.config.model?.provider || "ai";
  const providerColors: Record<string, { bg: string; text: string; ring: string }> = {
    openai: { bg: "bg-green-500/10", text: "text-green-400", ring: "ring-green-500/20" },
    claude: { bg: "bg-orange-500/10", text: "text-orange-400", ring: "ring-orange-500/20" },
    grok: { bg: "bg-blue-500/10", text: "text-blue-400", ring: "ring-blue-500/20" },
    gemini: { bg: "bg-purple-500/10", text: "text-purple-400", ring: "ring-purple-500/20" },
  };
  const colors = providerColors[provider] || { bg: "bg-slate-500/10", text: "text-slate-400", ring: "ring-slate-500/20" };

  const content = (
    <>
      {/* Icon */}
      <svg className={`h-3.5 w-3.5 flex-shrink-0 ${colors.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>

      {/* Name */}
      <span className={`font-medium truncate ${compact ? "max-w-[80px]" : "max-w-[150px]"}`}>
        {chatbot.name}
      </span>

      {/* Change indicator for clickable */}
      {clickable && onChangeChatbot && (
        <svg className={`h-3 w-3 flex-shrink-0 ${colors.text} opacity-60`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      )}
    </>
  );

  const baseClasses = `inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs ring-1 ring-inset ${colors.bg} ${colors.text} ${colors.ring} ${className}`;

  if (clickable && onChangeChatbot) {
    return (
      <button
        type="button"
        onClick={onChangeChatbot}
        className={`${baseClasses} hover:opacity-80 transition-opacity cursor-pointer`}
        title={`Using ${chatbot.name} configuration. Click to change.`}
      >
        {content}
      </button>
    );
  }

  return (
    <span
      className={baseClasses}
      title={`Using ${chatbot.name} configuration`}
    >
      {content}
    </span>
  );
}
