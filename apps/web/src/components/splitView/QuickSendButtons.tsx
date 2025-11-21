/**
 * Quick Send Buttons Component
 *
 * Displays quick-send buttons for each available target panel.
 * Provides a binary, deterministic way to route the current message
 * to a specific panel without relying on AI interpretation.
 *
 * When a button is clicked, the current draft message is sent
 * directly to the target panel.
 */

"use client";

import React from "react";
import type { QuickSendTarget } from "@/types/splitView";

interface QuickSendButtonsProps {
  targets: QuickSendTarget[];
  currentDraft: string;
  onQuickSend: (targetPanelId: 'left' | 'right', message: string) => void;
  disabled?: boolean;
  currentPanelId: 'left' | 'right';
}

export default function QuickSendButtons({
  targets,
  currentDraft,
  onQuickSend,
  disabled = false,
  currentPanelId,
}: QuickSendButtonsProps) {
  // Filter out the current panel from targets
  const availableTargets = targets.filter((target) => target.panelId !== currentPanelId && target.threadId !== null);

  // Don't render if no targets available
  if (availableTargets.length === 0) {
    return null;
  }

  const handleQuickSend = (targetPanelId: 'left' | 'right') => {
    if (!currentDraft.trim()) {
      return; // Don't send empty messages
    }

    // BINARY SEND - direct routing, no AI interpretation
    onQuickSend(targetPanelId, currentDraft);
  };

  return (
    <div className="flex items-center gap-2 border-t border-slate-800/50 bg-slate-900/30 px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-slate-400">Quick Send:</span>
        <div className="flex gap-2">
          {availableTargets.map((target) => (
            <button
              key={target.panelId}
              onClick={() => handleQuickSend(target.panelId)}
              disabled={disabled || !currentDraft.trim()}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                disabled || !currentDraft.trim()
                  ? 'cursor-not-allowed bg-slate-800 text-slate-500'
                  : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
              }`}
              title={`Send current message directly to ${target.panelName}`}
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
              <span>→ {target.panelName}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="ml-auto">
        <span className="text-xs text-slate-500">
          Direct routing (no AI interpretation)
        </span>
      </div>
    </div>
  );
}
