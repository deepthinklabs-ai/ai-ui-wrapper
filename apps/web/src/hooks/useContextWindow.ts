/**
 * Context Window Hook
 *
 * Tracks token usage across the conversation to show how much of the
 * context window is filled. Helps users know when to summarize or start a new thread.
 */

"use client";

import { useMemo, useEffect } from "react";
import type { Message } from "@/types/chat";
import type { AIModel } from "@/lib/apiKeyStorage";
import { AVAILABLE_MODELS } from "@/lib/apiKeyStorage";
import { calculateMessageTokens } from "@/lib/tokenCounter";
import { logTokenDebug } from "@/lib/tokenDebug";
import { useDebouncedValue } from "./useDebouncedValue";

type UseContextWindowOptions = {
  messages: Message[];
  currentModel: AIModel;
};

type UseContextWindowResult = {
  totalTokens: number;
  maxTokens: number;
  percentage: number;
  isNearLimit: boolean; // >= 75% (getting close)
  isAtLimit: boolean; // >= 90% (critical - stop now!)
  shouldSummarize: boolean; // >= 80% (time to summarize)
  modelInfo?: typeof AVAILABLE_MODELS[number]; // For debugging
};

export function useContextWindow(options: UseContextWindowOptions): UseContextWindowResult {
  const { messages, currentModel } = options;

  // Debounce the message count to prevent recalculating on every keystroke
  // Only recalculate when messages are actually sent, not while typing
  const messageCount = messages.length;
  const debouncedMessageCount = useDebouncedValue(messageCount, 500);

  const result = useMemo(() => {
    // Get the context window size for the current model
    const modelInfo = AVAILABLE_MODELS.find(m => m.value === currentModel);
    const maxTokens = modelInfo?.contextWindow || 128000; // Default fallback

    // Calculate total tokens used by all messages
    // Prefer actual token counts from API, fallback to estimation
    let totalTokens = 0;
    let hasActualTokens = false;

    messages.forEach(message => {
      // For assistant messages, use actual token counts if available
      if (message.role === 'assistant' && message.total_tokens) {
        totalTokens += message.total_tokens;
        hasActualTokens = true;
      } else {
        // For user messages or when actual tokens aren't available, use estimation
        totalTokens += calculateMessageTokens(message.content, message.attachments);
      }
    });

    // Add a conservative buffer for system prompts and formatting (~500 tokens)
    totalTokens += 500;

    // Calculate percentage (don't cap at 100% - let it go over to show overrun)
    const percentage = (totalTokens / maxTokens) * 100;

    return {
      totalTokens,
      maxTokens,
      percentage,
      isNearLimit: percentage >= 75,      // Getting close - monitor usage
      isAtLimit: percentage >= 90,        // Critical - stop and summarize NOW
      shouldSummarize: percentage >= 80,  // Strong recommendation to summarize
      modelInfo, // Include for debugging
    };
  }, [debouncedMessageCount, messages, currentModel]);

  // Debug logging - helps verify token counting accuracy
  useEffect(() => {
    if (messages.length > 0 && result.modelInfo) {
      logTokenDebug(messages, result.modelInfo.label, result.maxTokens);
    }
  }, [messages.length, currentModel]); // Only log when message count or model changes

  return result;
}
