/**
 * SSM Ollama Client
 *
 * Secure client for communicating with Ollama API for SSM inference.
 *
 * Security features:
 * - Endpoint validation (SSRF prevention)
 * - Request timeouts
 * - Response size limits
 * - Error sanitization (no sensitive data leakage)
 * - Retry with backoff
 *
 * Supports both Ollama and vLLM endpoints.
 */

import { validateOllamaEndpoint } from './ssmSanitization';
import type { SSMModelProvider } from '../../../types/ssm';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_TIMEOUT_MS = 30000; // 30 seconds
const MAX_RESPONSE_SIZE = 1024 * 1024; // 1MB max response
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// ============================================================================
// TYPES
// ============================================================================

export interface OllamaRequestOptions {
  endpoint: string;
  model: string;
  provider: SSMModelProvider;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  requestId?: string;
}

export interface OllamaResponse {
  success: boolean;
  content?: string;
  error?: string;
  latencyMs: number;
  tokensUsed?: number;
}

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  stream: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
}

interface OllamaGenerateResponse {
  response: string;
  done: boolean;
  total_duration?: number;
  eval_count?: number;
}

interface VLLMChatRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  max_tokens?: number;
  stream: boolean;
}

interface VLLMChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: {
    total_tokens: number;
  };
}

// ============================================================================
// CLIENT IMPLEMENTATION
// ============================================================================

/**
 * Execute SSM inference via Ollama or vLLM
 */
export async function executeSSMInference(options: OllamaRequestOptions): Promise<OllamaResponse> {
  const startTime = Date.now();
  const {
    endpoint,
    model,
    provider,
    systemPrompt,
    userPrompt,
    temperature = 0.3,
    maxTokens = 1000,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    requestId,
  } = options;

  // Validate endpoint
  const endpointValidation = validateOllamaEndpoint(endpoint);
  if (!endpointValidation.isValid) {
    return {
      success: false,
      error: endpointValidation.error || 'Invalid endpoint',
      latencyMs: Date.now() - startTime,
    };
  }

  const normalizedEndpoint = endpointValidation.normalizedUrl!;

  // Execute with retry logic
  let lastError: string = 'Unknown error';

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = provider === 'vllm'
        ? await executeVLLMRequest(normalizedEndpoint, model, systemPrompt, userPrompt, temperature, maxTokens, timeoutMs)
        : await executeOllamaRequest(normalizedEndpoint, model, systemPrompt, userPrompt, temperature, maxTokens, timeoutMs);

      return {
        ...response,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      lastError = sanitizeErrorMessage(error);

      // Don't retry on validation errors
      if (lastError.includes('Invalid') || lastError.includes('validation')) {
        break;
      }

      // Wait before retry
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1));
      }
    }
  }

  return {
    success: false,
    error: lastError,
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Execute request to Ollama API
 */
async function executeOllamaRequest(
  endpoint: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number,
  timeoutMs: number
): Promise<Omit<OllamaResponse, 'latencyMs'>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const requestBody: OllamaGenerateRequest = {
      model,
      prompt: userPrompt,
      system: systemPrompt,
      stream: false,
      options: {
        temperature,
        num_predict: maxTokens,
      },
    };

    const response = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Ollama API error: ${response.status} - ${sanitizeErrorMessage(errorText)}`);
    }

    // Check response size
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
      throw new Error('Response exceeds maximum allowed size');
    }

    const data: OllamaGenerateResponse = await response.json();

    return {
      success: true,
      content: data.response,
      tokensUsed: data.eval_count,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }

    throw error;
  }
}

/**
 * Execute request to vLLM API (OpenAI-compatible)
 */
async function executeVLLMRequest(
  endpoint: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxTokens: number,
  timeoutMs: number
): Promise<Omit<OllamaResponse, 'latencyMs'>> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const requestBody: VLLMChatRequest = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      stream: false,
    };

    const response = await fetch(`${endpoint}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`vLLM API error: ${response.status} - ${sanitizeErrorMessage(errorText)}`);
    }

    const data: VLLMChatResponse = await response.json();

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('Empty response from vLLM');
    }

    return {
      success: true,
      content,
      tokensUsed: data.usage?.total_tokens,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Request timed out');
    }

    throw error;
  }
}

/**
 * Check if Ollama/vLLM endpoint is reachable
 */
export async function checkEndpointHealth(
  endpoint: string,
  provider: SSMModelProvider
): Promise<{ healthy: boolean; error?: string }> {
  const validation = validateOllamaEndpoint(endpoint);
  if (!validation.isValid) {
    return { healthy: false, error: validation.error };
  }

  try {
    const healthUrl = provider === 'vllm'
      ? `${validation.normalizedUrl}/health`
      : `${validation.normalizedUrl}/api/tags`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(healthUrl, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return { healthy: response.ok };
  } catch (error) {
    return {
      healthy: false,
      error: sanitizeErrorMessage(error),
    };
  }
}

/**
 * List available models from Ollama
 */
export async function listOllamaModels(
  endpoint: string
): Promise<{ models: string[]; error?: string }> {
  const validation = validateOllamaEndpoint(endpoint);
  if (!validation.isValid) {
    return { models: [], error: validation.error };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`${validation.normalizedUrl}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error('Failed to fetch models');
    }

    const data = await response.json();
    const models = (data.models || []).map((m: { name: string }) => m.name);

    return { models };
  } catch (error) {
    return {
      models: [],
      error: sanitizeErrorMessage(error),
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Sanitize error messages to prevent sensitive data leakage
 */
function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Remove potential sensitive info (paths, IPs in non-allowed ranges, etc.)
    return error.message
      .replace(/\/[^\s]+/g, '[path]') // Remove file paths
      .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[ip]') // Remove IPs
      .substring(0, 200); // Limit length
  }

  if (typeof error === 'string') {
    return error.substring(0, 200);
  }

  return 'An unexpected error occurred';
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
