"use client";

import React, { KeyboardEvent, useRef } from "react";
import TextConversionButtons from "./TextConversionButtons";

type MessageComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  onSummarize?: () => void;
  onSummarizeAndContinue?: () => void;
  onFork?: () => void;
  canSummarize?: boolean;
  summarizing?: boolean;
  summarizingAndContinuing?: boolean;
  forking?: boolean;
  attachedFiles?: File[];
  onFilesChange?: (files: File[]) => void;
  onConvertToMarkdown?: () => void;
  onConvertToJson?: () => void;
  convertingToMarkdown?: boolean;
  convertingToJson?: boolean;
};

const MessageComposer: React.FC<MessageComposerProps> = ({
  value,
  onChange,
  onSend,
  disabled,
  onSummarize,
  onSummarizeAndContinue,
  onFork,
  canSummarize = false,
  summarizing = false,
  summarizingAndContinuing = false,
  forking = false,
  attachedFiles = [],
  onFilesChange,
  onConvertToMarkdown,
  onConvertToJson,
  convertingToMarkdown = false,
  convertingToJson = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && (value.trim() || attachedFiles.length > 0)) {
        onSend();
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onFilesChange) {
      const newFiles = Array.from(e.target.files);
      onFilesChange([...attachedFiles, ...newFiles]);
      // Reset input so the same file can be selected again
      e.target.value = "";
    }
  };

  const handleRemoveFile = (index: number) => {
    if (onFilesChange) {
      const newFiles = attachedFiles.filter((_, i) => i !== index);
      onFilesChange(newFiles);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="border-t border-slate-800 bg-slate-950 px-4 py-3">
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

      <div className="flex items-end gap-2">
        <div className="flex-1 flex flex-col gap-2">
          <textarea
            className="resize-none rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-600"
            rows={2}
            placeholder="Send a message… (Shift+Enter for new line)"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
          />
          {/* File Upload Button */}
          {onFilesChange && (
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
                disabled={disabled}
                className="flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-60"
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
          )}

          {/* Text Conversion Buttons */}
          {onConvertToMarkdown && onConvertToJson && (
            <TextConversionButtons
              hasText={!!value.trim()}
              convertingToMarkdown={convertingToMarkdown}
              convertingToJson={convertingToJson}
              onConvertToMarkdown={onConvertToMarkdown}
              onConvertToJson={onConvertToJson}
              disabled={disabled}
            />
          )}
        </div>
        <div className="flex flex-col gap-2">
          {onSummarize && (
            <button
              className="rounded-md border border-slate-600 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:opacity-60"
              onClick={onSummarize}
              disabled={!canSummarize || summarizing}
              title="Summarize this thread and add summary as a message"
            >
              {summarizing ? "Summarizing…" : "Summarize thread"}
            </button>
          )}
          {onSummarizeAndContinue && (
            <button
              className="rounded-md border border-emerald-600 bg-emerald-600/10 px-3 py-1 text-[11px] text-emerald-400 hover:bg-emerald-600/20 disabled:opacity-60 transition-all"
              onClick={onSummarizeAndContinue}
              disabled={!canSummarize || summarizing || summarizingAndContinuing}
              title="Summarize this thread and start a new thread with the summary as context"
            >
              {summarizingAndContinuing ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating new thread…
                </span>
              ) : (
                "Summarize & Continue"
              )}
            </button>
          )}
          {onFork && (
            <button
              className="rounded-md border border-purple-600 bg-purple-600/10 px-3 py-1 text-[11px] text-purple-400 hover:bg-purple-600/20 disabled:opacity-60 transition-all"
              onClick={onFork}
              disabled={!canSummarize || forking}
              title="Fork this thread - create a duplicate with all messages to explore different paths"
            >
              {forking ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Forking…
                </span>
              ) : (
                "Fork Thread"
              )}
            </button>
          )}
          <button
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60"
            onClick={onSend}
            disabled={disabled || (!value.trim() && attachedFiles.length === 0)}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageComposer;
