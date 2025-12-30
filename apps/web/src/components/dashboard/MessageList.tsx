"use client";

import React, { useEffect, useRef } from "react";
import type { Message } from "@/types/chat";
import type { AIModel } from "@/lib/apiKeyStorage";
import type { FeatureId } from "@/types/features";
import MessageItem from "./MessageItem";

type MessageListProps = {
  messages: Message[];
  loading: boolean;
  thinking: boolean;
  currentModel?: AIModel;
  onRevertToMessage?: (messageId: string, switchToOriginalModel: boolean) => void;
  onRevertWithDraft?: (messageId: string, switchToOriginalModel: boolean) => void;
  onForkFromMessage?: (messageId: string) => void;
  messageActionsDisabled?: boolean;
  isFeatureEnabled?: (featureId: FeatureId) => boolean;
};

const MessageList: React.FC<MessageListProps> = ({
  messages,
  loading,
  thinking,
  currentModel,
  onRevertToMessage,
  onRevertWithDraft,
  onForkFromMessage,
  messageActionsDisabled = false,
  isFeatureEnabled,
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom whenever messages change or thinking state toggles
  useEffect(() => {
    if (!bottomRef.current) return;
    bottomRef.current.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, thinking]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
      {loading && (
        <div className="text-xs text-foreground/60">Loading messages…</div>
      )}

      {messages.map((m, index) => (
        <MessageItem
          key={m.id}
          message={m}
          index={index}
          totalMessages={messages.length}
          currentModel={currentModel}
          onRevertToMessage={onRevertToMessage}
          onRevertWithDraft={onRevertWithDraft}
          onForkFromMessage={onForkFromMessage}
          messageActionsDisabled={messageActionsDisabled}
          nextMessage={messages[index + 1]}
          isFeatureEnabled={isFeatureEnabled}
        />
      ))}

      {/* Typing / thinking indicator */}
      {thinking && (
        <div className="flex w-full justify-start">
          <div className="max-w-[50%] rounded-lg px-3 py-2 text-sm bg-white/60 text-foreground border border-white/40 shadow-sm backdrop-blur-md">
            <div className="mb-1 text-[10px] uppercase tracking-wide opacity-70">
              Assistant
            </div>
            <div className="flex items-center gap-2 text-xs text-foreground/60">
              <span className="h-2 w-2 rounded-full bg-sky animate-pulse" />
              <span className="animate-pulse">Thinking…</span>
            </div>
          </div>
        </div>
      )}

      {!loading && messages.length === 0 && !thinking && (
        <div className="text-sm text-foreground">
          Start the conversation by sending a message.
        </div>
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
