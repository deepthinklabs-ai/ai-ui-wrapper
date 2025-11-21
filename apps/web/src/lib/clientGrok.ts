/**
 * Client-Side Grok (xAI) Service
 *
 * Makes API calls directly from the browser to xAI's Grok using the user's API key.
 * The API key is retrieved from localStorage and NEVER sent to our backend.
 * Grok uses an OpenAI-compatible API format.
 */

import { getGrokApiKey } from "./apiKeyStorage.grok";
import { getSelectedModel } from "./apiKeyStorage";
import type { MessageRole } from "@/types/chat";

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage = {
  role: MessageRole;
  content: string | ContentPart[];
};

export type ChatResponse = {
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  citations?: Array<{ url: string; title?: string }>;
};

/**
 * Send a chat request directly to xAI Grok from the browser
 *
 * @param messages - Array of chat messages
 * @param enableWebSearch - Enable live web search (default: true)
 * @returns The assistant's response text and token usage
 * @throws Error if no API key is set or if the API call fails
 */
export async function sendGrokChatRequest(
  messages: ChatMessage[],
  enableWebSearch: boolean = true
): Promise<ChatResponse> {
  const apiKey = getGrokApiKey();

  if (!apiKey) {
    throw new Error(
      "No Grok API key found. Please add your xAI API key in Settings."
    );
  }

  const model = getSelectedModel();

  const requestBody: any = {
    model,
    messages,
    stream: false,
  };

  // Add live search parameters if enabled
  if (enableWebSearch) {
    requestBody.search_parameters = {
      mode: "auto", // Model decides when to search
      sources: ["web", "x"], // Search web and X (Twitter)
      max_search_results: 20,
      return_citations: true,
    };
  }

  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;

      if (response.status === 401) {
        throw new Error(
          "Invalid Grok API key. Please check your xAI API key in Settings."
        );
      }

      if (response.status === 429) {
        throw new Error(
          "Rate limit exceeded. Please check your xAI account quota."
        );
      }

      throw new Error(`Grok API error: ${errorMessage}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error("No response from Grok");
    }

    // Extract token usage from response
    const usage = data.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };

    // Extract citations if present
    const citations = data.citations ? data.citations.map((url: string) => ({ url })) : undefined;

    return {
      content: reply,
      usage: {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      },
      citations,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to communicate with Grok API");
  }
}
