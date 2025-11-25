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
import { ToolCallDisplay } from "./ToolCallDisplay";

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
                code({ node, className, children, ...props }: any) {
                  // Check if it's inline code (no language/className or single line)
                  const isInline = !className;
                  return (
                    <CodeBlock
                      inline={isInline}
                      className={className}
                      {...props}
                    >
                      {String(children).replace(/\n$/, '')}
                    </CodeBlock>
                  );
                },
                a({ node, children, href, ...props }) {
                  return (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 underline decoration-blue-400/50 hover:decoration-blue-300 transition-colors"
                      {...props}
                    >
                      {children}
                    </a>
                  );
                },
              }}
            >
              {m.content}
            </ReactMarkdown>
          </div>

          {/* Show tool calls if present */}
          {m.tool_calls && m.tool_results && m.tool_calls.length > 0 && (
            <ToolCallDisplay toolCalls={m.tool_calls} toolResults={m.tool_results} />
          )}

          {/* Show citations if present */}
          {m.citations && m.citations.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-700/50">
              <div className="text-xs text-slate-400 mb-2">Sources:</div>
              <div className="flex flex-col gap-1">
                {m.citations.map((citation, idx) => (
                  <a
                    key={idx}
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300 underline decoration-blue-400/50 hover:decoration-blue-300 transition-colors flex items-start gap-1"
                  >
                    <span className="opacity-60">[{idx + 1}]</span>
                    <span className="flex-1 break-all">{citation.title || citation.url}</span>
                  </a>
                ))}
              </div>
            </div>
          )}
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
    prevProps.message.tool_calls === nextProps.message.tool_calls &&
    prevProps.message.tool_results === nextProps.message.tool_results &&
    prevProps.index === nextProps.index &&
    prevProps.totalMessages === nextProps.totalMessages &&
    prevProps.currentModel === nextProps.currentModel &&
    prevProps.messageActionsDisabled === nextProps.messageActionsDisabled &&
    prevProps.nextMessage?.id === nextProps.nextMessage?.id
  );
});
