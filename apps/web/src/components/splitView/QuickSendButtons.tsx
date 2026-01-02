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
    <div className="flex items-center gap-2 border-t border-white/20 bg-white/20 backdrop-blur-sm px-4 py-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-foreground/60">Quick Send:</span>
        <div className="flex gap-2">
          {availableTargets.map((target) => (
            <button
              key={target.panelId}
              onClick={() => handleQuickSend(target.panelId)}
              disabled={disabled || !currentDraft.trim()}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                disabled || !currentDraft.trim()
                  ? 'cursor-not-allowed bg-white/30 text-foreground/40'
                  : 'bg-sky text-foreground hover:bg-sky/80 active:bg-sky/70'
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
        <span className="text-xs text-foreground/50">
          Direct routing (no AI interpretation)
        </span>
      </div>
    </div>
  );
}
