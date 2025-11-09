/**
 * Unified AI Client
 *
 * Routes requests to the appropriate AI provider (OpenAI or Claude)
 * based on the selected model.
 */

import { sendClientChatRequest, type ChatMessage as OpenAIChatMessage } from "./clientOpenAI";
import { sendClaudeChatRequest, type ClaudeMessage, type ClaudeContentPart } from "./clientClaude";
import { getSelectedModel, getModelProvider, type AIModel } from "./apiKeyStorage";
import type { MessageRole } from "@/types/chat";

/**
 * Unified content part type that supports both OpenAI and Claude formats
 * Uses OpenAI format internally and converts to Claude format when needed
 */
export type UnifiedContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type UnifiedChatMessage = {
  role: MessageRole;
  content: string | UnifiedContentPart[]; // Can be string or content parts for vision
};

/**
 * Convert OpenAI content parts to Claude content parts
 */
function convertToClaudeContentParts(parts: UnifiedContentPart[]): ClaudeContentPart[] {
  return parts.map(part => {
    if (part.type === "text") {
      return { type: "text", text: part.text };
    } else if (part.type === "image_url") {
      // Extract base64 data from data URL
      const url = part.image_url.url;
      const match = url.match(/^data:([^;]+);base64,(.+)$/);

      if (!match) {
        throw new Error("Invalid image data URL format");
      }

      const mediaType = match[1];
      const base64Data = match[2];

      return {
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: base64Data,
        },
      };
    }

    throw new Error(`Unknown content part type: ${(part as any).type}`);
  });
}

/**
 * Send a chat request to the appropriate AI provider
 *
 * @param messages - Array of chat messages
 * @param model - Optional model override (uses stored model if not provided)
 * @returns The AI's response text
 */
export async function sendUnifiedChatRequest(
  messages: UnifiedChatMessage[],
  model?: AIModel
): Promise<string> {
  const selectedModel = model || getSelectedModel();
  const provider = getModelProvider(selectedModel);

  if (provider === "claude") {
    // Convert to Claude format
    const claudeMessages: ClaudeMessage[] = messages
      .filter((m) => m.role !== "system") // Claude handles system separately
      .map((msg) => {
        let content: string | ClaudeContentPart[];

        if (typeof msg.content === "string") {
          content = msg.content;
        } else {
          // Convert UnifiedContentPart[] to ClaudeContentPart[]
          content = convertToClaudeContentParts(msg.content);
        }

        return {
          role: msg.role === "user" ? "user" : "assistant",
          content,
        };
      });

    // Prepend system message if exists
    const systemMessage = messages.find((m) => m.role === "system");
    if (systemMessage && typeof systemMessage.content === "string") {
      claudeMessages.unshift({
        role: "user",
        content: `System: ${systemMessage.content}`,
      });
    }

    return await sendClaudeChatRequest(claudeMessages, selectedModel);
  } else {
    // OpenAI format
    const openaiMessages: OpenAIChatMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    return await sendClientChatRequest(openaiMessages);
  }
}
