/**
 * Push-to-Talk Hook
 *
 * Manages push-to-talk keyboard event handling and state.
 * Monitors the configured key binding and triggers voice input
 * when the key is pressed and held.
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  isPushToTalkEnabled,
  getPushToTalkKeybind,
  matchesKeybind,
  type KeyBinding,
} from "@/lib/pushToTalkStorage";

type UsePushToTalkOptions = {
  onPushStart?: () => void;
  onPushEnd?: () => void;
  disabled?: boolean;
};

type UsePushToTalkResult = {
  isPushing: boolean;
  isEnabled: boolean;
  keybind: KeyBinding;
};

export function usePushToTalk(options: UsePushToTalkOptions = {}): UsePushToTalkResult {
  const { onPushStart, onPushEnd, disabled = false } = options;

  const [isPushing, setIsPushing] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [keybind, setKeybind] = useState<KeyBinding>({ key: " " });

  // Track if we're currently in a push (to prevent repeat events)
  const pushingRef = useRef(false);

  // Load settings on mount
  useEffect(() => {
    setIsEnabled(isPushToTalkEnabled());
    setKeybind(getPushToTalkKeybind());
  }, []);

  // Listen for storage changes (settings updated in another tab/window)
  useEffect(() => {
    const handleStorageChange = () => {
      setIsEnabled(isPushToTalkEnabled());
      setKeybind(getPushToTalkKeybind());
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  // Handle keydown event
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Skip if disabled, not enabled, or already pushing
      if (disabled || !isEnabled || pushingRef.current) return;

      // Skip if user is typing in an input field (except if it's the composer textarea)
      const target = event.target as HTMLElement;
      const isInInput =
        target.tagName === "INPUT" ||
        target.tagName === "SELECT" ||
        target.isContentEditable;

      // Allow if it's a textarea (the composer)
      const isTextarea = target.tagName === "TEXTAREA";

      if (isInInput && !isTextarea) return;

      // Check if the event matches our key binding
      if (matchesKeybind(event, keybind)) {
        event.preventDefault();
        pushingRef.current = true;
        setIsPushing(true);
        onPushStart?.();
      }
    },
    [disabled, isEnabled, keybind, onPushStart]
  );

  // Handle keyup event
  const handleKeyUp = useCallback(
    (event: KeyboardEvent) => {
      // Only handle if we're currently pushing
      if (!pushingRef.current) return;

      // Check if the released key matches our key binding
      if (matchesKeybind(event, keybind)) {
        event.preventDefault();
        pushingRef.current = false;
        setIsPushing(false);
        onPushEnd?.();
      }
    },
    [keybind, onPushEnd]
  );

  // Set up global keyboard listeners
  useEffect(() => {
    if (!isEnabled || disabled) {
      // If disabled, ensure we're not in a pushing state
      if (pushingRef.current) {
        pushingRef.current = false;
        setIsPushing(false);
        onPushEnd?.();
      }
      return;
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);

      // Clean up if component unmounts while pushing
      if (pushingRef.current) {
        pushingRef.current = false;
        setIsPushing(false);
        onPushEnd?.();
      }
    };
  }, [isEnabled, disabled, handleKeyDown, handleKeyUp, onPushEnd]);

  return {
    isPushing,
    isEnabled,
    keybind,
  };
}
