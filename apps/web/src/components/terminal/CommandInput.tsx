/**
 * Command Input Component
 *
 * Input area for Terminal Bot with file/image upload support.
 * Similar to Genesis Bot's composer but styled for terminal interface.
 */

"use client";

import React, { useRef, KeyboardEvent } from "react";

type CommandInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  attachedFiles: File[];
  onFilesChange: (files: File[]) => void;
  disabled: boolean;
};

export default function CommandInput({
  value,
  onChange,
  onSend,
  attachedFiles,
  onFilesChange,
  disabled,
}: CommandInputProps) {
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
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      onFilesChange([...attachedFiles, ...newFiles]);
      // Reset input so the same file can be selected again
      e.target.value = "";
    }
  };

  const handleRemoveFile = (index: number) => {
    const newFiles = attachedFiles.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-4">
      {/* Attached Files Display */}
      {attachedFiles.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {attachedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center gap-2 rounded border border-slate-700 bg-slate-800 px-3 py-2 text-xs"
            >
              <div className="flex items-center gap-2">
                {file.type.startsWith("image/") ? (
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
                <div className="flex flex-col">
                  <span className="text-slate-200 font-medium">{file.name}</span>
                  <span className="text-slate-500">{formatFileSize(file.size)}</span>
                </div>
              </div>
              <button
                onClick={() => handleRemoveFile(index)}
                className="ml-2 rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                title="Remove file"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

      {/* Input Area */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your command or question... (Shift+Enter for new line)"
            disabled={disabled}
            className="w-full h-20 resize-none rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-50 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-600 font-mono"
          />

          {/* Action Buttons Row */}
          <div className="mt-2 flex items-center gap-2">
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
                disabled={disabled}
                className="flex items-center gap-2 rounded border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-700 disabled:opacity-60"
                title="Attach files or images"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                  />
                </svg>
                Attach Files
              </button>
            </div>

            <div className="text-xs text-slate-500">
              Press <kbd className="rounded bg-slate-700 px-1.5 py-0.5">Enter</kbd> to send
            </div>
          </div>
        </div>

        {/* Send Button */}
        <button
          onClick={onSend}
          disabled={disabled || (!value.trim() && attachedFiles.length === 0)}
          className="rounded bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors h-20"
        >
          {disabled ? (
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            "Send"
          )}
        </button>
      </div>
    </div>
  );
}
