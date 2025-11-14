/**
 * Cross Chat Hook
 *
 * Manages communication between two AI panels in split view.
 * Allows the AIs to send messages to each other.
 */

"use client";

import { useCallback, useRef, useEffect } from "react";

interface UseCrossChatOptions {
  enabled: boolean;
  onSendToLeft: (message: string) => Promise<void>;
  onSendToRight: (message: string) => Promise<void>;
}

interface UseCrossChatResult {
  relayMessageToLeft: (message: string) => Promise<void>;
  relayMessageToRight: (message: string) => Promise<void>;
}

export function useCrossChat({
  enabled,
  onSendToLeft,
  onSendToRight,
}: UseCrossChatOptions): UseCrossChatResult {
  const isRelaying = useRef(false);

  /**
   * Relay a message from right panel to left panel
   */
  const relayMessageToLeft = useCallback(
    async (message: string) => {
      if (!enabled || isRelaying.current) return;

      try {
        isRelaying.current = true;

        // Format message to indicate it's from the other AI
        const relayedMessage = `**[Message from Right Panel AI]**\n\n${message}`;

        await onSendToLeft(relayedMessage);
      } finally {
        // Delay to prevent infinite loops
        setTimeout(() => {
          isRelaying.current = false;
        }, 1000);
      }
    },
    [enabled, onSendToLeft]
  );

  /**
   * Relay a message from left panel to right panel
   */
  const relayMessageToRight = useCallback(
    async (message: string) => {
      if (!enabled || isRelaying.current) return;

      try {
        isRelaying.current = true;

        // Format message to indicate it's from the other AI
        const relayedMessage = `**[Message from Left Panel AI]**\n\n${message}`;

        await onSendToRight(relayedMessage);
      } finally {
        // Delay to prevent infinite loops
        setTimeout(() => {
          isRelaying.current = false;
        }, 1000);
      }
    },
    [enabled, onSendToRight]
  );

  return {
    relayMessageToLeft,
    relayMessageToRight,
  };
}
