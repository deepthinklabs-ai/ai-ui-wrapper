/**
 * Memoized Message Item Component
 *
 * Individual message component that only re-renders when its own props change.
 * This significantly improves performance in long threads by preventing
 * unnecessary re-renders of all messages when typing.
 */

"use client";

import React, { memo } from "react";
import type { Message } from "@/types/chat";
import type { AIModel } from "@/lib/apiKeyStorage";
import type { FeatureId } from "@/types/features";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MessageActions from "./MessageActions";
import CodeBlock from "@/components/markdown/CodeBlock";

type MessageItemProps = {
  message: Message;
  index: number;
  totalMessages: number;
  currentModel?: AIModel;
  onRevertToMessage?: (messageId: string, switchToOriginalModel: boolean) => void;
  onRevertWithDraft?: (messageId: string, switchToOriginalModel: boolean) => void;
  onForkFromMessage?: (messageId: string) => void;
  messageActionsDisabled?: boolean;
  nextMessage?: Message;
  isFeatureEnabled?: (featureId: FeatureId) => boolean;
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

const MessageItem: React.FC<MessageItemProps> = ({
  message: m,
  index,
  totalMessages,
  currentModel,
  onRevertToMessage,
  onRevertWithDraft,
  onForkFromMessage,
  messageActionsDisabled = false,
  nextMessage,
  isFeatureEnabled,
}) => {
  const isUser = m.role === "user";
  const isSummary = m.content.startsWith("**Thread summary**");
  const isLastMessage = index === totalMessages - 1;
  const label = isUser
    ? "You"
    : isSummary
    ? "Summary"
    : m.role === "assistant"
    ? "Assistant"
    : "System";

  const timestamp = formatTimestamp(m.created_at);

  // Check if this user message has an AI response after it (for "Revert with Draft" button)
  const hasAiResponseAfter = isUser && nextMessage?.role === "assistant";

  return (
    <div
      className={`flex w-full ${
        isUser ? "justify-end" : "justify-start"
      } group`}
    >
      <div className="flex flex-col gap-0 max-w-[70%]">
        {/* Message Actions - show on all messages (different buttons for user vs assistant) */}
        {onRevertToMessage && onForkFromMessage && onRevertWithDraft && currentModel && (
          <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <MessageActions
              messageId={m.id}
              messageModel={m.model}
              isLastMessage={isLastMessage}
              isUserMessage={isUser}
              currentModel={currentModel}
              messagesAfterCount={totalMessages - index - 1}
              onRevert={onRevertToMessage}
              onRevertWithDraft={onRevertWithDraft}
              onForkFrom={onForkFromMessage}
              hasAiResponseAfter={hasAiResponseAfter}
              disabled={messageActionsDisabled}
              isFeatureEnabled={isFeatureEnabled}
            />
          </div>
        )}

        {/* Message Content */}
        <div
          className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
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
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                code({ node, inline, className, children, ...props }) {
                  return (
                    <CodeBlock
                      inline={inline}
                      className={className}
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </CodeBlock>
                  );
                },
              }}
            >
              {m.content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
// Only re-render when props actually change
export default memo(MessageItem, (prevProps, nextProps) => {
  // Custom comparison function for optimal performance
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.index === nextProps.index &&
    prevProps.totalMessages === nextProps.totalMessages &&
    prevProps.currentModel === nextProps.currentModel &&
    prevProps.messageActionsDisabled === nextProps.messageActionsDisabled &&
    prevProps.nextMessage?.id === nextProps.nextMessage?.id
  );
});
