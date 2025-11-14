/**
 * Split View Hook
 *
 * Manages state for the split-screen dual chat feature.
 * Allows users to view and interact with two threads simultaneously.
 */

"use client";

import { useState, useCallback } from "react";
import type { SplitViewState } from "@/types/splitView";

interface UseSplitViewResult {
  splitView: SplitViewState;
  activateSplitView: (leftThreadId: string, rightThreadId: string | null) => void;
  deactivateSplitView: () => void;
  setSplitRatio: (ratio: number) => void;
  swapPanels: () => void;
  setLeftThread: (threadId: string) => void;
  setRightThread: (threadId: string) => void;
  toggleCrossChat: () => void;
}

export function useSplitView(): UseSplitViewResult {
  const [splitView, setSplitView] = useState<SplitViewState>({
    isActive: false,
    leftThreadId: null,
    rightThreadId: null,
    splitRatio: 50, // 50/50 split by default
    crossChatEnabled: false,
  });

  /**
   * Activate split view with two threads
   */
  const activateSplitView = useCallback((leftThreadId: string, rightThreadId: string | null) => {
    setSplitView({
      isActive: true,
      leftThreadId,
      rightThreadId,
      splitRatio: 50,
    });
  }, []);

  /**
   * Deactivate split view and return to single chat
   */
  const deactivateSplitView = useCallback(() => {
    setSplitView({
      isActive: false,
      leftThreadId: null,
      rightThreadId: null,
      splitRatio: 50,
    });
  }, []);

  /**
   * Update the split ratio (0-100)
   */
  const setSplitRatio = useCallback((ratio: number) => {
    setSplitView((prev) => ({
      ...prev,
      splitRatio: Math.max(20, Math.min(80, ratio)), // Clamp between 20-80%
    }));
  }, []);

  /**
   * Swap the left and right panels
   */
  const swapPanels = useCallback(() => {
    setSplitView((prev) => ({
      ...prev,
      leftThreadId: prev.rightThreadId,
      rightThreadId: prev.leftThreadId,
      splitRatio: 100 - prev.splitRatio,
    }));
  }, []);

  /**
   * Set the left panel thread
   */
  const setLeftThread = useCallback((threadId: string) => {
    setSplitView((prev) => ({
      ...prev,
      leftThreadId: threadId,
    }));
  }, []);

  /**
   * Set the right panel thread
   */
  const setRightThread = useCallback((threadId: string) => {
    setSplitView((prev) => ({
      ...prev,
      rightThreadId: threadId,
    }));
  }, []);

  /**
   * Toggle cross-chat mode (AIs talking to each other)
   */
  const toggleCrossChat = useCallback(() => {
    setSplitView((prev) => ({
      ...prev,
      crossChatEnabled: !prev.crossChatEnabled,
    }));
  }, []);

  return {
    splitView,
    activateSplitView,
    deactivateSplitView,
    setSplitRatio,
    swapPanels,
    setLeftThread,
    setRightThread,
    toggleCrossChat,
  };
}
