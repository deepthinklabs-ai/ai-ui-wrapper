/**
 * Unified AI Client
 *
 * Routes requests to the appropriate AI provider (OpenAI, Claude, Grok, or Gemini)
 * based on the selected model. All requests go through backend API proxy
 * using BYOK (Bring Your Own Key) model.
 *
 * - Trial users: Use backend API proxy with 25% rate limits
 * - Pro users: Use backend API proxy with full rate limits
 * - Expired users: Blocked from making requests
 */

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
 * Send chat request via Pro API proxy (for Pro users)
 * SECURITY: Uses Authorization header for authentication instead of userId in body
 */
async function sendProChatRequest(
  messages: UnifiedChatMessage[],
  model: AIModel,
  provider: 'openai' | 'claude' | 'grok' | 'gemini',
  accessToken: string,
  tools?: any
): Promise<UnifiedChatResponse> {
  const endpoint =
    provider === 'openai' ? '/api/pro/openai' :
    provider === 'claude' ? '/api/pro/claude' :
    provider === 'gemini' ? '/api/pro/gemini' :
    '/api/pro/grok';

  const requestBody: any = {
    messages,
    model,
  };

  // Add tools if provided
  if (tools) {
    requestBody.tools = tools;
  }

  // SECURITY: Send access token in Authorization header for server-side authentication
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
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
 * All requests are routed through backend API proxy using corporate API keys.
 *
 * SECURITY: Requires accessToken for server-side authentication.
 * The server extracts the userId from the validated token, preventing IDOR attacks.
 *
 * @param messages - Array of chat messages
 * @param options - Configuration options (accessToken required)
 * @returns The AI's response text and token usage
 */
export async function sendUnifiedChatRequest(
  messages: UnifiedChatMessage[],
  options?: {
    model?: AIModel;
    userTier?: UserTier;
    accessToken?: string;
    tools?: any;
    enableWebSearch?: boolean;
  }
): Promise<UnifiedChatResponse> {
  const { model, userTier = 'trial', accessToken, tools } = options || {};
  const selectedModel = model || getSelectedModel();
  const provider = getModelProvider(selectedModel);

  // Block expired users
  if (userTier === 'expired') {
    throw new Error('Your trial has expired. Please subscribe to continue using the service.');
  }

  // SECURITY: accessToken is required for authenticated API calls
  if (!accessToken) {
    throw new Error('Authentication required. Please sign in.');
  }

  // All users (trial and pro) route through backend API proxy
  return sendProChatRequest(messages, selectedModel, provider, accessToken, tools);
}
