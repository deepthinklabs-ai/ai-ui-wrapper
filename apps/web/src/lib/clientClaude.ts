/**
 * Client-Side Claude (Anthropic) Service
 *
 * Makes API calls directly from the browser to Anthropic using the user's API key.
 * The API key is retrieved from localStorage and NEVER sent to our backend.
 */

import { getClaudeApiKey } from "./apiKeyStorage.claude";

export type ClaudeMessage = {
  role: "user" | "assistant";
  content: string | ClaudeContentPart[];
};

export type ClaudeContentPart =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

export type ClaudeResponse = {
  content: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
};

// Map our internal model names to Claude API model names
// Updated with actual Claude 4+ models as of 2025
const CLAUDE_API_MODEL_MAP: Record<string, string> = {
  'claude-sonnet-4-5': 'claude-sonnet-4-5-20250929', // Latest Sonnet 4.5
  'claude-sonnet-4': 'claude-sonnet-4-20250514',     // Claude Sonnet 4
  'claude-opus-4-1': 'claude-opus-4-1-20250805',     // Latest Opus 4.1
  'claude-haiku-4-5': 'claude-haiku-4-5-20251001',   // Latest Haiku 4.5
  'claude-haiku-3-5': 'claude-3-5-haiku-20241022',   // Claude 3.5 Haiku
};

/**
 * Send a chat request directly to Claude from the browser
 *
 * @param messages - Array of chat messages
 * @param model - The Claude model to use
 * @param enableWebSearch - Enable web search tool (default: true)
 * @returns The assistant's response text and token usage
 * @throws Error if no API key is set or if the API call fails
 */
export async function sendClaudeChatRequest(
  messages: ClaudeMessage[],
  model: string,
  enableWebSearch: boolean = true
): Promise<ClaudeResponse> {
  const apiKey = getClaudeApiKey();

  if (!apiKey) {
    throw new Error(
      "No Claude API key found. Please add your Anthropic API key in Settings."
    );
  }

  // Get the actual Claude API model name
  const apiModel = CLAUDE_API_MODEL_MAP[model] || model;

  // Claude API requires separating system messages
  const systemMessages = messages.filter((m) => m.role === "user" && typeof m.content === "string" && m.content.startsWith("System:"));
  const conversationMessages = messages.filter((m) => !systemMessages.includes(m));

  // Extract system prompt if exists
  let systemPrompt = "";
  if (systemMessages.length > 0 && typeof systemMessages[0].content === "string") {
    systemPrompt = systemMessages[0].content.replace(/^System:\s*/, "");
  }

  // Build request body for Claude API
  const requestBody: any = {
    model: apiModel,
    max_tokens: 8192,
    messages: conversationMessages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    })),
  };

  // Add system prompt if provided
  if (systemPrompt) {
    requestBody.system = systemPrompt;
  }

  // Add web search tool if enabled
  if (enableWebSearch) {
    requestBody.tools = [
      {
        type: "web_search_20250305",
        name: "web_search",
      },
      ...(requestBody.tools || [])
    ];
  }

  try {
    // Call Claude API directly from browser (CORS enabled as of Aug 2024)
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true", // Required for CORS
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || response.statusText;

      if (response.status === 401) {
        throw new Error(
          "Invalid Claude API key. Please check your API key in Settings."
        );
      }

      if (response.status === 429) {
        throw new Error(
          "Rate limit exceeded. Please check your Anthropic account quota."
        );
      }

      throw new Error(`Claude API error: ${errorMessage}`);
    }

    const data = await response.json();

    // Extract the text content from Claude's response
    const content = data.content?.[0]?.text;

    if (!content) {
      throw new Error("No response from Claude");
    }

    // Extract token usage from response
    const usage = data.usage || {
      input_tokens: 0,
      output_tokens: 0,
    };

    return {
      content: content,
      usage: {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
        total_tokens: usage.input_tokens + usage.output_tokens,
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to communicate with Claude");
  }
}

/**
 * Test if the user's Claude API key is valid by making a simple API call
 *
 * @param apiKey - The API key to test
 * @returns true if valid, false otherwise
 */
export async function testClaudeApiKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true", // Required for CORS
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-20241022",
        max_tokens: 10,
        messages: [
          {
            role: "user",
            content: "Hi",
          },
        ],
      }),
    });

    return response.ok;
  } catch (error) {
    console.error("Error testing Claude API key:", error);
    return false;
  }
}
