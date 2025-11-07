"use client";

import React, { KeyboardEvent } from "react";

type MessageComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  onSummarize?: () => void;
  canSummarize?: boolean;
  summarizing?: boolean;
};

const MessageComposer: React.FC<MessageComposerProps> = ({
  value,
  onChange,
  onSend,
  disabled,
  onSummarize,
  canSummarize = false,
  summarizing = false,
}) => {
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) {
        onSend();
      }
    }
  };

  return (
    <div className="border-t border-slate-800 bg-slate-950 px-4 py-3">
      <div className="flex items-end gap-2">
        <textarea
          className="flex-1 resize-none rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-sky-600"
          rows={2}
          placeholder="Send a message… (Shift+Enter for new line)"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <div className="flex flex-col gap-2">
          {onSummarize && (
            <button
              className="rounded-md border border-slate-600 px-3 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:opacity-60"
              onClick={onSummarize}
              disabled={!canSummarize || summarizing}
            >
              {summarizing ? "Summarizing…" : "Summarize thread"}
            </button>
          )}
          <button
            className="rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-60"
            onClick={onSend}
            disabled={disabled || !value.trim()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

export default MessageComposer;
