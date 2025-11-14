/**
 * Token Debugging Utility
 *
 * Helps debug and verify token counting accuracy
 */

import type { Message } from "@/types/chat";
import { calculateMessageTokens } from "./tokenCounter";

/**
 * Calculate detailed token breakdown for debugging
 */
export function getTokenBreakdown(messages: Message[]): {
  totalEstimated: number;
  messageBreakdown: Array<{
    role: string;
    contentLength: number;
    estimatedTokens: number;
    hasAttachments: boolean;
  }>;
} {
  const messageBreakdown = messages.map(msg => ({
    role: msg.role,
    contentLength: msg.content.length,
    estimatedTokens: calculateMessageTokens(msg.content, msg.attachments),
    hasAttachments: !!(msg.attachments && msg.attachments.length > 0),
  }));

  const totalEstimated = messageBreakdown.reduce((sum, msg) => sum + msg.estimatedTokens, 0);

  return {
    totalEstimated,
    messageBreakdown,
  };
}

/**
 * Log token information to console for debugging
 */
export function logTokenDebug(messages: Message[], modelName: string, maxTokens: number): void {
  const breakdown = getTokenBreakdown(messages);
  const percentage = (breakdown.totalEstimated / maxTokens) * 100;

  console.group(`🔍 Token Debug - ${modelName}`);
  console.log(`Total Messages: ${messages.length}`);
  console.log(`Estimated Tokens: ${breakdown.totalEstimated.toLocaleString()}`);
  console.log(`Max Tokens: ${maxTokens.toLocaleString()}`);
  console.log(`Usage: ${percentage.toFixed(2)}%`);
  console.log(`\nMessage Breakdown:`);
  breakdown.messageBreakdown.forEach((msg, idx) => {
    console.log(`  ${idx + 1}. [${msg.role}] ${msg.estimatedTokens} tokens (${msg.contentLength} chars)${msg.hasAttachments ? ' 📎' : ''}`);
  });
  console.groupEnd();
}
