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
  citations?: Array<{ url: string; title?: string; cited_text?: string }>;
};

// Map models to their search-enabled variants
const SEARCH_ENABLED_MODELS: Record<string, string> = {
  'gpt-5.1': 'gpt-5.1',
  'gpt-5.1-mini': 'gpt-5.1-mini',
  'gpt-5.1-nano': 'gpt-5.1-nano',
  'gpt-4o': 'gpt-4o-search-preview',
};

/**
 * Send a chat request directly to OpenAI from the browser
 *
 * @param messages - Array of chat messages
 * @param enableWebSearch - Enable web search for supported models (default: true)
 * @returns The assistant's response text and token usage
 * @throws Error if no API key is set or if the API call fails
 */
export async function sendClientChatRequest(
  messages: ChatMessage[],
  enableWebSearch: boolean = true
): Promise<ChatResponse> {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error(
      "No API key found. Please add your OpenAI API key in Settings."
    );
  }

  const baseModel = getSelectedModel();

  // Use search-enabled model if available and requested
  const model = enableWebSearch && SEARCH_ENABLED_MODELS[baseModel]
    ? SEARCH_ENABLED_MODELS[baseModel]
    : baseModel;

  const requestBody: any = {
    model,
    messages,
  };

  // Note: For GPT-5 and GPT-4o search models, web search is built-in
  // No need to add tools - the model automatically searches when needed

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
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

    // Extract citations from annotations (for search-enabled models)
    const message = data.choices?.[0]?.message;
    const annotations = message?.annotations || [];
    const annotationCitations = annotations
      .filter((ann: any) => ann.type === 'url_citation' && ann.url_citation?.url)
      .map((ann: any) => ({
        url: ann.url_citation.url,
        title: ann.url_citation.title || undefined,
        cited_text: ann.url_citation.text || undefined,
      }));

    // Also extract inline markdown links from the response text
    // This catches URLs the AI explicitly formatted in its response
    const markdownLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const inlineLinks: Array<{ url: string; title?: string }> = [];
    let match;

    while ((match = markdownLinkRegex.exec(reply)) !== null) {
      const [, title, url] = match;
      // Only include http/https URLs, skip relative links
      if (url.startsWith('http://') || url.startsWith('https://')) {
        inlineLinks.push({ url, title });
      }
    }

    // Combine both sources of citations, preferring inline links (more specific)
    // Use a Map to deduplicate by URL
    const citationMap = new Map<string, { url: string; title?: string; cited_text?: string }>();

    // Add inline links first (higher priority)
    inlineLinks.forEach(link => {
      citationMap.set(link.url, { url: link.url, title: link.title });
    });

    // Add annotation citations (only if URL not already present)
    annotationCitations.forEach((citation: any) => {
      if (!citationMap.has(citation.url)) {
        citationMap.set(citation.url, citation);
      }
    });

    const citations = Array.from(citationMap.values());

    return {
      content: reply,
      usage: {
        prompt_tokens: usage.prompt_tokens,
        completion_tokens: usage.completion_tokens,
        total_tokens: usage.total_tokens,
      },
      citations: citations.length > 0 ? citations : undefined,
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
