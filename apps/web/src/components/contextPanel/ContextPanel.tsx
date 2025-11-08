/**
 * Context Panel Component
 *
 * A slide-in panel from the right side that allows users to ask questions
 * about highlighted text without polluting the main conversation thread.
 */

"use client";

import React, { useState, KeyboardEvent } from "react";

type ContextMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type ContextPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  contextText: string;
  threadMessages?: { role: "user" | "assistant"; content: string }[];
  onSubmit: (question: string, contextText: string, threadMessages?: { role: "user" | "assistant"; content: string }[]) => Promise<string>;
};

const ContextPanel: React.FC<ContextPanelProps> = ({
  isOpen,
  onClose,
  contextText,
  threadMessages,
  onSubmit,
}) => {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ContextMessage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!question.trim() || isSubmitting) return;

    const userMessage: ContextMessage = {
      role: "user",
      content: question,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    setIsSubmitting(true);

    try {
      const response = await onSubmit(question, contextText, threadMessages);

      const assistantMessage: ContextMessage = {
        role: "assistant",
        content: response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error getting response:", error);
      const errorMessage: ContextMessage = {
        role: "assistant",
        content: "Sorry, I encountered an error processing your question.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleClose = () => {
    setMessages([]);
    setQuestion("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 animate-in fade-in duration-200"
        onClick={handleClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-screen w-[500px] bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3 bg-slate-900">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-slate-100">
              Context Question
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            title="Close panel"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Context Display */}
        <div className="border-b border-slate-700 bg-purple-950/20 px-4 py-3">
          <div className="text-xs font-medium text-purple-400 mb-1">
            SELECTED CONTEXT
          </div>
          <div className="text-sm text-slate-300 bg-slate-800/50 rounded-md px-3 py-2 max-h-32 overflow-y-auto">
            {contextText}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-slate-500 text-sm py-8">
              Ask a question about the selected context above
            </div>
          )}

          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-purple-600 text-white"
                    : "bg-slate-800 text-slate-100 border border-slate-700"
                }`}
              >
                <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-wide opacity-70">
                  <span>{msg.role === "user" ? "You" : "Assistant"}</span>
                  <span className="text-[10px] opacity-75">
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}

          {isSubmitting && (
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-lg px-3 py-2 text-sm bg-slate-800 text-slate-100 border border-slate-700">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                  <span className="text-slate-400 text-xs">Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-700 bg-slate-900 px-4 py-3">
          <div className="flex gap-2">
            <textarea
              className="flex-1 resize-none rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={2}
              placeholder="Ask a question about the context..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isSubmitting}
            />
            <button
              onClick={handleSubmit}
              disabled={!question.trim() || isSubmitting}
              className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ContextPanel;
