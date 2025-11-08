/**
 * Context Chat Client
 *
 * Handles API calls for context-based questions that are isolated from
 * the main conversation thread. Uses the same LLM but with context-specific
 * prompting.
 */

import { sendChatRequest } from "./chatClient";
import type { MessageRole } from "@/types/chat";

/**
 * Sends a question about specific context to the LLM
 *
 * @param question - The user's question
 * @param contextText - The highlighted/selected text to provide context
 * @param threadMessages - Optional array of previous messages from the thread for additional context
 * @returns The LLM's response
 */
export async function askContextQuestion(
  question: string,
  contextText: string,
  threadMessages?: { role: MessageRole; content: string }[]
): Promise<string> {
  const systemPrompt = `You are a helpful AI assistant. The user has highlighted some text from an ongoing conversation and wants to ask a question about it.

The highlighted context is:
"""
${contextText}
"""

${threadMessages && threadMessages.length > 0
  ? `You also have access to the full conversation thread for additional context. Use this to better understand the highlighted text and provide more informed answers.`
  : `Please answer the user's question specifically in relation to this highlighted context.`}

Be concise and directly address their question.`;

  const messages: { role: MessageRole; content: string }[] = [
    { role: "system", content: systemPrompt },
  ];

  // Include thread messages if provided, to give full conversational context
  if (threadMessages && threadMessages.length > 0) {
    messages.push(...threadMessages);
  }

  // Add the user's question about the highlighted context
  messages.push({ role: "user", content: question });

  const response = await sendChatRequest(messages);
  return response;
}
