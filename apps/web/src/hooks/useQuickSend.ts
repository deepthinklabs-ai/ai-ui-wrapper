/**
 * Quick Send Hook
 *
 * Manages quick-send button functionality for direct message routing
 * between panels in split view mode. This is a binary, deterministic
 * routing system that does NOT rely on AI interpretation.
 */

"use client";

import { useCallback, useRef } from "react";
import type { QuickSendTarget } from "@/types/splitView";

interface UseQuickSendProps {
  currentPanelId: 'left' | 'right';
  currentThreadId: string | null;
}

interface UseQuickSendResult {
  quickSendMessage: (targetPanelId: 'left' | 'right', message: string) => Promise<void>;
  registerSendFunction: (panelId: 'left' | 'right', sendFn: (message: string, files: File[]) => Promise<void>) => void;
}

export function useQuickSend({ currentPanelId, currentThreadId }: UseQuickSendProps): UseQuickSendResult {
  // Store send functions for each panel
  const leftSendRef = useRef<((message: string, files: File[]) => Promise<void>) | null>(null);
  const rightSendRef = useRef<((message: string, files: File[]) => Promise<void>) | null>(null);

  /**
   * Register a send function for a specific panel
   * This allows panels to expose their sendMessage function
   */
  const registerSendFunction = useCallback(
    (panelId: 'left' | 'right', sendFn: (message: string, files: File[]) => Promise<void>) => {
      if (panelId === 'left') {
        leftSendRef.current = sendFn;
      } else {
        rightSendRef.current = sendFn;
      }
    },
    []
  );

  /**
   * Send a message directly to a target panel
   * This is a BINARY operation - no AI interpretation involved
   */
  const quickSendMessage = useCallback(
    async (targetPanelId: 'left' | 'right', message: string) => {
      const targetSendFn = targetPanelId === 'left' ? leftSendRef.current : rightSendRef.current;

      if (!targetSendFn) {
        console.error(`[QuickSend] No send function registered for ${targetPanelId} panel`);
        return;
      }

      if (!message.trim()) {
        console.warn(`[QuickSend] Empty message, skipping send to ${targetPanelId}`);
        return;
      }

      try {
        console.log(`[QuickSend] Sending message from ${currentPanelId} to ${targetPanelId}:`, message);

        // BINARY SEND - direct message routing with no AI involvement
        await targetSendFn(message, []);

        console.log(`[QuickSend] Message successfully sent to ${targetPanelId}`);
      } catch (error) {
        console.error(`[QuickSend] Failed to send message to ${targetPanelId}:`, error);
      }
    },
    [currentPanelId]
  );

  return {
    quickSendMessage,
    registerSendFunction,
  };
}
