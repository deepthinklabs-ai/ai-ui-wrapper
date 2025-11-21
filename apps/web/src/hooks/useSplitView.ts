/**
 * Split View Hook
 *
 * Manages state for the split-screen dual chat feature.
 * Allows users to view and interact with two threads simultaneously.
 */

"use client";

import { useState, useCallback } from "react";
import type { SplitViewState, MessageType } from "@/types/splitView";

interface UseSplitViewResult {
  splitView: SplitViewState;
  activateSplitView: (leftThreadId: string, rightThreadId: string | null) => void;
  deactivateSplitView: () => void;
  setSplitRatio: (ratio: number) => void;
  swapPanels: () => void;
  setLeftThread: (threadId: string) => void;
  setRightThread: (threadId: string) => void;
  toggleCrossChat: () => void;
  setLeftPanelName: (name: string) => void;
  setRightPanelName: (name: string) => void;
  setMessageType: (type: MessageType) => void;
}

export function useSplitView(): UseSplitViewResult {
  const [splitView, setSplitView] = useState<SplitViewState>({
    isActive: false,
    leftThreadId: null,
    rightThreadId: null,
    splitRatio: 50, // 50/50 split by default
    crossChatEnabled: false,
    leftPanelName: "Main Chat",
    rightPanelName: "Assistant",
    messageType: "instruction", // Default to instruction mode
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
      crossChatEnabled: false,
      leftPanelName: "Main Chat",
      rightPanelName: "Assistant",
      messageType: "instruction",
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
      crossChatEnabled: false,
      leftPanelName: "Main Chat",
      rightPanelName: "Assistant",
      messageType: "instruction",
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

  /**
   * Set the left panel name
   */
  const setLeftPanelName = useCallback((name: string) => {
    setSplitView((prev) => ({
      ...prev,
      leftPanelName: name,
    }));
  }, []);

  /**
   * Set the right panel name
   */
  const setRightPanelName = useCallback((name: string) => {
    setSplitView((prev) => ({
      ...prev,
      rightPanelName: name,
    }));
  }, []);

  /**
   * Set the message type (instruction or chat)
   */
  const setMessageType = useCallback((type: MessageType) => {
    setSplitView((prev) => ({
      ...prev,
      messageType: type,
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
    setLeftPanelName,
    setRightPanelName,
    setMessageType,
  };
}
