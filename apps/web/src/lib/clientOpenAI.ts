/**
 * Client-Side OpenAI Service
 *
 * Makes API calls directly from the browser to OpenAI using the user's API key.
 * The API key is retrieved from localStorage and NEVER sent to our backend.
 */

import { getApiKey, getSelectedModel } from "./apiKeyStorage";
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
};

/**
 * Send a chat request directly to OpenAI from the browser
 *
 * @param messages - Array of chat messages
 * @returns The assistant's response text and token usage
 * @throws Error if no API key is set or if the API call fails
 */
export async function sendClientChatRequest(
  messages: ChatMessage[]
): Promise<ChatResponse> {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error(
      "No API key found. Please add your OpenAI API key in Settings."
    );
  }

  const model = getSelectedModel();

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;

      if (response.status === 401) {
        throw new Error(
          "Invalid API key. Please check your API key in Settings."
        );
      }

      if (response.status === 429) {
        throw new Error(
          "Rate limit exceeded. Please check your OpenAI account quota."
        );
      }

      throw new Error(`OpenAI API error: ${errorMessage}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      throw new Error("No response from OpenAI");
    }

    // Extract token usage from response
    const usage = data.usage || {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    };

    return {
      content: reply,
      usage: {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to communicate with OpenAI");
  }
}

/**
 * Test if the user's API key is valid by making a simple API call
 *
 * @param apiKey - The API key to test
 * @returns true if valid, false otherwise
 */
export async function testApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.openai.com/v1/models", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    return response.ok;
  } catch (error) {
    console.error("Error testing API key:", error);
    return false;
  }
}
