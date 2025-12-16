"use client";

/**
 * ChatbotList Component
 *
 * Displays a list of chatbots in the sidebar.
 * Simplified list without folder hierarchy.
 */

import React from "react";
import type { Chatbot } from "@/types/chatbot";
import { ChatbotItem } from "./ChatbotItem";

type ChatbotListProps = {
  /** List of chatbots to display */
  chatbots: Chatbot[];
  /** Currently selected chatbot ID */
  selectedChatbotId: string | null;
  /** Called when a chatbot is selected */
  onSelectChatbot: (id: string) => void;
  /** Called when starting a new thread with a chatbot */
  onStartChatbotThread?: (chatbotId: string, chatbotName: string) => void;
  /** Called when duplicate action is triggered */
  onDuplicateChatbot?: (id: string) => void;
  /** Called when export action is triggered */
  onExportChatbot?: (id: string) => void;
  /** Called when delete action is triggered */
  onDeleteChatbot?: (id: string) => void;
  /** Called when rename is triggered */
  onRenameChatbot?: (id: string, newName: string) => void;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional class names */
  className?: string;
};

export function ChatbotList({
  chatbots,
  selectedChatbotId,
  onSelectChatbot,
  onStartChatbotThread,
  onDuplicateChatbot,
  onExportChatbot,
  onDeleteChatbot,
  onRenameChatbot,
  emptyMessage = "No chatbots yet. Create one to get started.",
  className = "",
}: ChatbotListProps) {
  if (chatbots.length === 0) {
    return (
      <div className={`px-2 py-1 text-xs text-slate-500 ${className}`}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <ul className={`space-y-1 ${className}`}>
      {chatbots.map((chatbot) => (
        <li key={chatbot.id}>
          <ChatbotItem
            chatbot={chatbot}
            isSelected={chatbot.id === selectedChatbotId}
            onClick={() => onSelectChatbot(chatbot.id)}
            onStartThread={onStartChatbotThread ? () => onStartChatbotThread(chatbot.id, chatbot.name) : undefined}
            onDuplicate={onDuplicateChatbot ? () => onDuplicateChatbot(chatbot.id) : undefined}
            onExport={onExportChatbot ? () => onExportChatbot(chatbot.id) : undefined}
            onDelete={onDeleteChatbot ? () => onDeleteChatbot(chatbot.id) : undefined}
            onRename={onRenameChatbot ? (newName) => onRenameChatbot(chatbot.id, newName) : undefined}
          />
        </li>
      ))}
    </ul>
  );
}
