/**
 * Terminal Chat Component
 *
 * Displays the terminal conversation with messages, file attachments,
 * and command outputs in a terminal-styled interface.
 */

"use client";

import React, { useRef, useEffect } from "react";
import type { TerminalMessage } from "@/types/terminal";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeBlock from "@/components/markdown/CodeBlock";

type TerminalChatProps = {
  messages: TerminalMessage[];
  isProcessing: boolean;
};

export default function TerminalChat({ messages, isProcessing }: TerminalChatProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length, isProcessing]);

  const getRoleColor = (role: string) => {
    switch (role) {
      case "user":
        return "text-green-400";
      case "assistant":
        return "text-blue-400";
      case "system":
        return "text-yellow-400";
      case "error":
        return "text-red-400";
      default:
        return "text-slate-400";
    }
  };

  const getRolePrefix = (role: string) => {
    switch (role) {
      case "user":
        return "$ ";
      case "assistant":
        return ">> ";
      case "system":
        return "[SYSTEM] ";
      case "error":
        return "[ERROR] ";
      default:
        return "> ";
    }
  };

  return (
    <div className="flex flex-col h-full rounded-lg border border-slate-700 bg-slate-900">
      {/* Terminal Header */}
      <div className="flex items-center gap-2 border-b border-slate-700 px-4 py-2 bg-slate-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
        </div>
        <span className="text-xs text-slate-400 font-mono">Terminal Bot Command</span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 font-mono text-sm">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <svg className="h-16 w-16 text-slate-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-slate-500 text-sm">
              Start typing a command or question...
              <br />
              <span className="text-xs">Upload files and images like Genesis Bot!</span>
            </p>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className="space-y-2">
            {/* Message Header */}
            <div className="flex items-center gap-2">
              <span className={`font-bold ${getRoleColor(message.role)}`}>
                {getRolePrefix(message.role)}
              </span>
              <span className="text-xs text-slate-500">
                {message.timestamp.toLocaleTimeString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              {message.exitCode !== undefined && (
                <span
                  className={`text-xs px-2 py-0.5 rounded ${
                    message.exitCode === 0
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  exit {message.exitCode}
                </span>
              )}
            </div>

            {/* Attachments */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 ml-4">
                {message.attachments.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs"
                  >
                    {file.isImage ? (
                      <svg className="h-4 w-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    )}
                    <span className="text-slate-300">{file.name}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Message Content */}
            <div className="ml-4 text-slate-200 whitespace-pre-wrap break-words">
              {message.role === "user" ? (
                <span>{message.content}</span>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ node, inline, className, children, ...props }) {
                        return (
                          <CodeBlock inline={inline} className={className} {...props}>
                            {String(children).replace(/\n$/, "")}
                          </CodeBlock>
                        );
                      },
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="font-bold text-blue-400">&gt;&gt; </span>
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
            <div className="ml-4 text-slate-400 text-xs">Processing command...</div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
