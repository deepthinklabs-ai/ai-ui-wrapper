/**
 * Unified AI Client
 *
 * Routes requests to the appropriate AI provider (OpenAI, Claude, or Grok)
 * based on the selected model and user tier.
 *
 * - Pro users: Use backend API proxy (no API keys needed)
 * - Free users: Direct browser calls (must provide their own API keys)
 */

import { sendClientChatRequest, type ChatMessage as OpenAIChatMessage } from "./clientOpenAI";
import { sendClaudeChatRequest, type ClaudeMessage, type ClaudeContentPart } from "./clientClaude";
import { sendGrokChatRequest, type ChatMessage as GrokChatMessage } from "./clientGrok";
import { getSelectedModel, getModelProvider, type AIModel } from "./apiKeyStorage";
import type { MessageRole } from "@/types/chat";
import type { UserTier } from "@/hooks/useUserTier";

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

export type UnifiedChatResponse = {
  content: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  stop_reason?: string;
  contentBlocks?: any[];
  citations?: Array<{ url: string; title?: string; cited_text?: string }>;
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
 * Send chat request via Pro API proxy (for Pro users)
 */
async function sendProChatRequest(
  userId: string,
  messages: UnifiedChatMessage[],
  model: AIModel,
  provider: 'openai' | 'claude' | 'grok',
  tools?: any
): Promise<UnifiedChatResponse> {
  const endpoint =
    provider === 'openai' ? '/api/pro/openai' :
    provider === 'claude' ? '/api/pro/claude' :
    '/api/pro/grok';

  const requestBody: any = {
    userId,
    messages,
    model,
  };

  // Add tools if provided
  if (tools) {
    requestBody.tools = tools;
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Pro API error: ${response.statusText}`);
  }

  const data = await response.json();

  return {
    content: data.content,
    usage: {
      input_tokens: data.usage.input_tokens || data.usage.prompt_tokens || 0,
      output_tokens: data.usage.output_tokens || data.usage.completion_tokens || 0,
      total_tokens: data.usage.total_tokens || 0,
    },
    stop_reason: data.stop_reason,
    contentBlocks: data.contentBlocks,
    citations: data.citations,
  };
}

/**
 * Send a chat request to the appropriate AI provider
 *
 * @param messages - Array of chat messages
 * @param options - Configuration options
 * @returns The AI's response text and token usage
 */
export async function sendUnifiedChatRequest(
  messages: UnifiedChatMessage[],
  options?: {
    model?: AIModel;
    userTier?: UserTier;
    userId?: string;
    tools?: any;
    enableWebSearch?: boolean;
  }
): Promise<UnifiedChatResponse> {
  const { model, userTier = 'free', userId, tools, enableWebSearch = true } = options || {};
  const selectedModel = model || getSelectedModel();
  const provider = getModelProvider(selectedModel);

  // Pro users: Route to backend API proxy
  if (userTier === 'pro') {
    if (!userId) {
      throw new Error('userId is required for Pro users');
    }
    return sendProChatRequest(userId, messages, selectedModel, provider, tools);
  }

  // Free users: Direct browser calls (existing behavior)
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

    const response = await sendClaudeChatRequest(claudeMessages, selectedModel, enableWebSearch);
    return {
      content: response.content,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
        total_tokens: response.usage.total_tokens,
      },
    };
  } else if (provider === "grok") {
    // Grok uses OpenAI-compatible format
    const grokMessages: GrokChatMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const response = await sendGrokChatRequest(grokMessages, enableWebSearch);
    return {
      content: response.content,
      usage: {
        input_tokens: response.usage.prompt_tokens,
        output_tokens: response.usage.completion_tokens,
        total_tokens: response.usage.total_tokens,
      },
      citations: response.citations,
    };
  } else {
    // OpenAI format
    const openaiMessages: OpenAIChatMessage[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    const response = await sendClientChatRequest(openaiMessages, enableWebSearch);
    return {
      content: response.content,
      usage: {
        input_tokens: response.usage.prompt_tokens,
        output_tokens: response.usage.completion_tokens,
        total_tokens: response.usage.total_tokens,
      },
      citations: response.citations,
    };
  }
}
