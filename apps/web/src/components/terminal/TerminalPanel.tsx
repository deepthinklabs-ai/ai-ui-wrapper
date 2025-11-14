/**
 * Terminal Panel Component
 *
 * Main container for the Terminal Bot Command feature.
 * Provides a GUI wrapper for CLI-based AI tools with file/image support.
 */

"use client";

import React, { useState } from "react";
import type { UserTier } from "@/hooks/useUserTier";
import type { TerminalSession, TerminalMessage, TerminalAttachment } from "@/types/terminal";
import TerminalChat from "./TerminalChat";
import CommandInput from "./CommandInput";
import FileTreeViewer from "./FileTreeViewer";
import { useTerminalBot } from "@/hooks/useTerminalBot";
import { useClaudeCodeBridge } from "@/hooks/useClaudeCodeBridge";
import { useFileSystemAccess } from "@/hooks/useFileSystemAccess";

type TerminalPanelProps = {
  userId: string;
  userTier: UserTier;
};

export default function TerminalPanel({ userId, userTier }: TerminalPanelProps) {
  const [draft, setDraft] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [useBridgeMode, setUseBridgeMode] = useState(false);

  // File system access
  const {
    rootDirectory,
    fileTree,
    isScanning,
    selectDirectory,
    readFile,
    writeFile,
    deleteFile,
    clearDirectory,
  } = useFileSystemAccess();

  // Regular AI mode
  const aiMode = useTerminalBot({
    userId,
    userTier,
    fileTree,
    readFile,
    writeFile,
    deleteFile,
  });

  // Bridge mode (real Claude Code)
  const bridgeMode = useClaudeCodeBridge();

  // Choose which mode to use
  const {
    messages,
    isProcessing,
    sendCommand,
    clearSession,
  } = useBridgeMode ? bridgeMode : aiMode;

  const handleSend = async () => {
    if (!draft.trim() && attachedFiles.length === 0) return;

    await sendCommand(draft, attachedFiles);
    setDraft("");
    setAttachedFiles([]);
  };

  const handleClearSession = () => {
    if (messages.length > 0) {
      if (confirm("Are you sure you want to clear this session? All messages will be deleted.")) {
        clearSession();
        setDraft("");
        setAttachedFiles([]);
      }
    }
  };

  return (
    <div className="flex h-full w-full justify-center overflow-hidden bg-slate-950">
      <div className="flex h-full w-full max-w-7xl gap-4 px-6 py-6 overflow-hidden">
        {/* LEFT: Main chat area */}
        <div className="flex flex-1 flex-col gap-4 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between flex-shrink-0">
            <div>
              <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                Terminal Bot Command
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                {useBridgeMode
                  ? '🌉 Connected to real Claude Code CLI'
                  : 'CLI power with GUI simplicity • Claude Code wrapper with file & image support'}
              </p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={handleClearSession}
                className="rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
              >
                Clear Session
              </button>
            )}
          </div>

          {/* Bridge Mode Controls */}
          <div className="flex-shrink-0 rounded-lg border border-slate-700 bg-slate-900 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-300">Mode:</span>
                  <button
                    onClick={() => {
                      if (useBridgeMode && bridgeMode.isConnected) {
                        if (confirm('Disconnect from Claude Code bridge?')) {
                          bridgeMode.disconnect();
                          setUseBridgeMode(false);
                        }
                      } else {
                        setUseBridgeMode(!useBridgeMode);
                      }
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      useBridgeMode ? 'bg-green-600' : 'bg-slate-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        useBridgeMode ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                  <span className="text-sm text-slate-400">
                    {useBridgeMode ? 'Bridge Mode (Real Claude Code)' : 'AI Mode (Simulated)'}
                  </span>
                </div>

                {useBridgeMode && (
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        bridgeMode.isConnected ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <span className="text-xs text-slate-500">
                      {bridgeMode.isConnected ? 'Connected' : 'Disconnected'}
                    </span>
                  </div>
                )}
              </div>

              {useBridgeMode && (
                <div className="flex items-center gap-2">
                  {!bridgeMode.isConnected ? (
                    <button
                      onClick={async () => {
                        try {
                          await bridgeMode.connect();
                          await bridgeMode.startClaudeCode();
                        } catch (error) {
                          alert(
                            `Failed to connect: ${
                              error instanceof Error ? error.message : 'Unknown error'
                            }\n\nMake sure the bridge is running:\ncd claude-code-bridge && npm run dev`
                          );
                        }
                      }}
                      disabled={!bridgeMode.isBridgeAvailable}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Connect to Bridge
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        bridgeMode.disconnect();
                      }}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 transition-colors"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              )}
            </div>

            {useBridgeMode && !bridgeMode.isBridgeAvailable && (
              <div className="mt-3 rounded border border-yellow-500/30 bg-yellow-500/10 p-3">
                <p className="text-xs text-yellow-300">
                  ⚠️ Bridge server is not running. Start it with:{' '}
                  <code className="rounded bg-slate-800 px-1 py-0.5">
                    cd claude-code-bridge && npm run dev
                  </code>
                </p>
              </div>
            )}
          </div>

        {/* Info Banner */}
        <div className="flex-shrink-0 rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-blue-300">What is Terminal Bot Command?</h4>
              <p className="mt-1 text-sm text-blue-200/80">
                This is a GUI wrapper for Claude Code and other CLI-based AI tools. Unlike command-line interfaces,
                you can upload images, attach files, and use an intuitive chat interface - making powerful terminal AI accessible to everyone.
              </p>
            </div>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 min-h-0">
          <TerminalChat
            messages={messages}
            isProcessing={isProcessing}
          />
        </div>

          {/* Command Input */}
          <div className="flex-shrink-0">
            <CommandInput
              value={draft}
              onChange={setDraft}
              onSend={handleSend}
              attachedFiles={attachedFiles}
              onFilesChange={setAttachedFiles}
              disabled={isProcessing}
            />
          </div>
        </div>

        {/* RIGHT: File system panel */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-4 overflow-hidden">
          {/* Connect Directory Button */}
          {!fileTree && (
            <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
              <div className="flex flex-col items-center text-center gap-4">
                <svg className="h-12 w-12 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                <div>
                  <h3 className="text-sm font-semibold text-slate-200 mb-2">No Project Connected</h3>
                  <p className="text-xs text-slate-400 mb-4">
                    Connect a project directory to give Terminal Bot access to your files - just like Claude Code!
                  </p>
                </div>
                <button
                  onClick={selectDirectory}
                  disabled={isScanning}
                  className="w-full rounded bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
                >
                  {isScanning ? "Scanning..." : "Connect Directory"}
                </button>
                <p className="text-xs text-slate-500">
                  Only Chrome and Edge browsers support this feature
                </p>
              </div>
            </div>
          )}

          {/* File Tree Viewer */}
          {fileTree && <FileTreeViewer fileTree={fileTree} onClearDirectory={clearDirectory} />}

          {/* Info about file access */}
          {fileTree && (
            <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
              <div className="flex gap-2">
                <svg className="h-5 w-5 text-green-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <h4 className="text-xs font-medium text-green-300">Directory Connected</h4>
                  <p className="mt-1 text-xs text-green-200/80">
                    Terminal Bot can now see your project files and help with code changes.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
