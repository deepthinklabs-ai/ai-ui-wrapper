/**
 * API Key Storage Utility
 *
 * Manages OpenAI API key storage in browser localStorage.
 * Keys are NEVER sent to our backend - only stored client-side.
 */

const API_KEY_STORAGE_KEY = 'openai_api_key';
const MODEL_STORAGE_KEY = 'openai_model';

export type AIModel =
  // OpenAI Models (GPT-5 generation)
  | 'gpt-5.1'
  | 'gpt-5-mini'
  | 'gpt-5-nano'
  // OpenAI Models (GPT-4 generation)
  | 'gpt-4o'
  | 'gpt-4o-mini'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo'
  // Claude Models
  | 'claude-sonnet-4-5'
  | 'claude-sonnet-4'
  | 'claude-opus-4-1'
  | 'claude-haiku-4-5'
  | 'claude-haiku-3-5'
  // Grok Models
  | 'grok-4-fast-reasoning'
  | 'grok-4-fast-non-reasoning'
  | 'grok-4-1-fast-reasoning'
  | 'grok-4-1-fast-non-reasoning'
  | 'grok-code-fast-1'
  // Gemini Models
  | 'gemini-2.0-flash'
  | 'gemini-1.5-pro'
  | 'gemini-1.5-flash';

export type ModelProvider = 'openai' | 'claude' | 'grok' | 'gemini';

export type ModelCapabilities = {
  supportsImages: boolean;
  supportsFiles: boolean;
  supportedFileTypes?: string[];
};

export const AVAILABLE_MODELS: {
  value: AIModel;
  label: string;
  description: string;
  provider: ModelProvider;
  capabilities: ModelCapabilities;
  contextWindow: number; // Maximum tokens
}[] = [
  // Claude Models (Claude 4+ generation)
  {
    value: 'claude-sonnet-4-5',
    label: 'Claude Sonnet 4.5',
    description: 'Most intelligent Claude model, best for coding and complex agents • Supports images • Web search enabled',
    provider: 'claude',
    capabilities: { supportsImages: true, supportsFiles: true },
    contextWindow: 200000,
  },
  {
    value: 'claude-sonnet-4',
    label: 'Claude Sonnet 4',
    description: 'Powerful model for advanced reasoning and analysis • Supports images • Web search enabled',
    provider: 'claude',
    capabilities: { supportsImages: true, supportsFiles: true },
    contextWindow: 200000,
  },
  {
    value: 'claude-opus-4-1',
    label: 'Claude Opus 4.1',
    description: 'Highest intelligence model for complex tasks and deep analysis • Supports images • Web search enabled',
    provider: 'claude',
    capabilities: { supportsImages: true, supportsFiles: true },
    contextWindow: 200000,
  },
  {
    value: 'claude-haiku-4-5',
    label: 'Claude Haiku 4.5',
    description: 'Fast and cost-effective, great balance of speed and capability • Supports images • Web search enabled',
    provider: 'claude',
    capabilities: { supportsImages: true, supportsFiles: true },
    contextWindow: 200000,
  },
  {
    value: 'claude-haiku-3-5',
    label: 'Claude Haiku 3.5',
    description: 'Ultra-fast and cheapest Claude option • Supports images • Web search enabled',
    provider: 'claude',
    capabilities: { supportsImages: true, supportsFiles: true },
    contextWindow: 200000,
  },
  // OpenAI Models (GPT-5.1 generation)
  {
    value: 'gpt-5.1',
    label: 'GPT-5.1',
    description: 'Latest OpenAI model with adaptive reasoning, best for coding and agentic tasks • Supports images • Web search enabled',
    provider: 'openai',
    capabilities: { supportsImages: true, supportsFiles: true },
    contextWindow: 272000,
  },
  {
    value: 'gpt-5-mini',
    label: 'GPT-5 Mini',
    description: 'Faster and more affordable alternative to GPT-5, great balance of power and performance • Supports images',
    provider: 'openai',
    capabilities: { supportsImages: true, supportsFiles: true },
    contextWindow: 128000,
  },
  {
    value: 'gpt-5-nano',
    label: 'GPT-5 Nano',
    description: 'Fastest and most affordable reasoning model, excels at summarization and classification • Supports images',
    provider: 'openai',
    capabilities: { supportsImages: true, supportsFiles: true },
    contextWindow: 128000,
  },
  {
    value: 'gpt-4o',
    label: 'GPT-4o',
    description: 'Previous generation flagship • Supports images • Web search enabled',
    provider: 'openai',
    capabilities: { supportsImages: true, supportsFiles: true },
    contextWindow: 128000,
  },
  {
    value: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    description: 'Fast and cost-efficient GPT-4 variant • Supports images',
    provider: 'openai',
    capabilities: { supportsImages: true, supportsFiles: true },
    contextWindow: 128000,
  },
  {
    value: 'gpt-4-turbo',
    label: 'GPT-4 Turbo',
    description: 'Earlier GPT-4 version with extended context • Supports images',
    provider: 'openai',
    capabilities: { supportsImages: true, supportsFiles: true },
    contextWindow: 128000,
  },
  {
    value: 'gpt-3.5-turbo',
    label: 'GPT-3.5 Turbo',
    description: 'Legacy model, fastest and cheapest • Text only (no images)',
    provider: 'openai',
    capabilities: { supportsImages: false, supportsFiles: false },
    contextWindow: 16385,
  },
  // Grok Models (xAI)
  // Grok 4 Fast models
  {
    value: 'grok-4-fast-reasoning',
    label: 'Grok 4 Fast Reasoning',
    description: 'Grok 4 with reasoning capabilities • 2M context window • Supports images • Live web & X search',
    provider: 'grok',
    capabilities: { supportsImages: true, supportsFiles: true },
    contextWindow: 2000000,
  },
  {
    value: 'grok-4-fast-non-reasoning',
    label: 'Grok 4 Fast Non-Reasoning',
    description: 'Grok 4 without deep reasoning for faster responses • 2M context window • Supports images • Live web & X search',
    provider: 'grok',
    capabilities: { supportsImages: true, supportsFiles: true },
    contextWindow: 2000000,
  },
  // Grok 4.1 Fast models
  {
    value: 'grok-4-1-fast-reasoning',
    label: 'Grok 4.1 Fast Reasoning',
    description: 'Frontier multimodal model optimized for high-performance agentic tool calling • Supports images • Live web & X search',
    provider: 'grok',
    capabilities: { supportsImages: true, supportsFiles: true },
    contextWindow: 131072,
  },
  {
    value: 'grok-4-1-fast-non-reasoning',
    label: 'Grok 4.1 Fast Non-Reasoning',
    description: 'Fast responses without deep reasoning • Supports images • Live web & X search',
    provider: 'grok',
    capabilities: { supportsImages: true, supportsFiles: true },
    contextWindow: 131072,
  },
  {
    value: 'grok-code-fast-1',
    label: 'Grok Code Fast 1',
    description: 'Optimized for coding tasks with fast response times • Supports images • Live web & X search',
    provider: 'grok',
    capabilities: { supportsImages: true, supportsFiles: true },
    contextWindow: 256000,
  },
  // Gemini Models (Google)
  {
    value: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    description: 'Google\'s latest multimodal model, fast and capable • Supports images and files',
    provider: 'gemini',
    capabilities: { supportsImages: true, supportsFiles: true },
    contextWindow: 1000000,
  },
  {
    value: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    description: 'Google\'s powerful model with extended context • Supports images and files',
    provider: 'gemini',
    capabilities: { supportsImages: true, supportsFiles: true },
    contextWindow: 2000000,
  },
  {
    value: 'gemini-1.5-flash',
    label: 'Gemini 1.5 Flash',
    description: 'Fast and cost-effective Gemini model • Supports images and files',
    provider: 'gemini',
    capabilities: { supportsImages: true, supportsFiles: true },
    contextWindow: 1000000,
  },
];

/**
 * Get the stored OpenAI API key from localStorage
 */
export function getApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

/**
 * Save OpenAI API key to localStorage
 */
export function setApiKey(apiKey: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
}

/**
 * Remove OpenAI API key from localStorage
 */
export function clearApiKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}

/**
 * Check if an API key is currently stored
 */
export function hasApiKey(): boolean {
  const key = getApiKey();
  return key !== null && key.length > 0;
}

/**
 * Get the selected AI model from localStorage
 */
export function getSelectedModel(): AIModel {
  if (typeof window === 'undefined') return 'gpt-5.1';
  const stored = localStorage.getItem(MODEL_STORAGE_KEY);
  return (stored as AIModel) || 'gpt-5.1';
}

/**
 * Save the selected AI model to localStorage
 */
export function setSelectedModel(model: AIModel): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MODEL_STORAGE_KEY, model);
}

/**
 * Get the provider for a given model
 */
export function getModelProvider(model: AIModel): ModelProvider {
  const modelInfo = AVAILABLE_MODELS.find(m => m.value === model);
  return modelInfo?.provider || 'openai';
}
