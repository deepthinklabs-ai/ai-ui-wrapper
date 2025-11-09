/**
 * Context Panel Component
 *
 * A slide-in panel from the right side that allows users to ask questions
 * about highlighted text without polluting the main conversation thread.
 */

"use client";

import React, { useState, KeyboardEvent, useRef } from "react";
import type { AIModel } from "@/lib/apiKeyStorage";
import { getFileUploadWarning } from "@/lib/modelCapabilities";

type ContextMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

type ContextPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  contextSections: string[];
  onRemoveSection?: (index: number) => void;
  threadMessages?: { role: "user" | "assistant"; content: string }[];
  selectedModel?: AIModel;
  onSubmit: (
    question: string,
    contextSections: string[],
    threadMessages?: { role: "user" | "assistant"; content: string }[],
    files?: File[]
  ) => Promise<string>;
};

const ContextPanel: React.FC<ContextPanelProps> = ({
  isOpen,
  onClose,
  contextSections,
  onRemoveSection,
  threadMessages,
  selectedModel,
  onSubmit,
}) => {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ContextMessage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if current model supports the attached files
  const fileWarning = selectedModel ? getFileUploadWarning(selectedModel, attachedFiles) : null;

  const handleSubmit = async () => {
    if ((!question.trim() && attachedFiles.length === 0) || isSubmitting) return;

    const userMessage: ContextMessage = {
      role: "user",
      content: question || "Here are the files:",
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setQuestion("");
    const filesToSend = [...attachedFiles];
    setAttachedFiles([]);
    setIsSubmitting(true);

    try {
      const response = await onSubmit(question, contextSections, threadMessages, filesToSend);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setAttachedFiles((prev) => [...prev, ...newFiles]);
      e.target.value = "";
    }
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
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
    setAttachedFiles([]);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Panel - No backdrop to allow full interaction with main chat */}
      <div className="fixed right-0 top-0 h-screen w-[500px] bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3 bg-slate-900">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
            <h2 className="text-sm font-semibold text-slate-100">
              Ask a Question About This Highlighted Text
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

        {/* Context Display - Multiple Sections */}
        <div className="border-b border-slate-700 bg-purple-950/20 px-4 py-3 max-h-64 overflow-y-auto">
          <div className="text-xs font-medium text-purple-400 mb-2">
            SELECTED CONTEXT ({contextSections.length} {contextSections.length === 1 ? "SECTION" : "SECTIONS"})
            <span className="text-purple-400/60 ml-1">• Highlight more text to add sections</span>
          </div>
          <div className="space-y-2">
            {contextSections.map((section, index) => (
              <div
                key={index}
                className="group relative text-sm text-slate-300 bg-slate-800/50 rounded-md px-3 py-2 border-l-2 border-purple-500 hover:bg-slate-800/70 transition-colors"
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[10px] text-purple-400 font-medium">
                    Section {index + 1}
                  </div>
                  {onRemoveSection && (
                    <button
                      onClick={() => onRemoveSection(index)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-red-600/20 text-slate-400 hover:text-red-400"
                      title="Remove this section"
                    >
                      <svg
                        className="h-3.5 w-3.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
                {section}
              </div>
            ))}
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
          {/* File Upload Warning */}
          {fileWarning && (
            <div className="mb-3 rounded-md border border-amber-600 bg-amber-600/10 px-3 py-2 text-xs text-amber-400">
              <div className="flex items-start gap-2">
                <svg
                  className="h-4 w-4 flex-shrink-0 mt-0.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
                <span>{fileWarning}</span>
              </div>
            </div>
          )}

          {/* Attached Files Display */}
          {attachedFiles.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {attachedFiles.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    {file.type.startsWith("image/") ? (
                      <svg
                        className="h-4 w-4 text-purple-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    ) : (
                      <svg
                        className="h-4 w-4 text-blue-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    )}
                    <div className="flex flex-col">
                      <span className="text-slate-200 font-medium">{file.name}</span>
                      <span className="text-slate-500">{formatFileSize(file.size)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveFile(index)}
                    className="ml-2 rounded-md p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                    title="Remove file"
                  >
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2">
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
                disabled={(!question.trim() && attachedFiles.length === 0) || isSubmitting}
                className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? "Sending..." : "Send"}
              </button>
            </div>

            {/* File Upload Button */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                className="hidden"
                accept="image/*,.pdf,.txt,.md,.json,.csv,.js,.ts,.tsx,.jsx,.py,.java,.c,.cpp,.html,.css,.xml,.yaml,.yml"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-md border border-purple-600 bg-purple-600/10 px-3 py-1.5 text-xs text-purple-300 hover:bg-purple-600/20 disabled:opacity-60"
                title="Attach files or images"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
                Attach files
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ContextPanel;
