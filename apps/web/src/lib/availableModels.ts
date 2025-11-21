/**
 * Available Models Utility
 *
 * Filters available AI models based on which API keys the user has configured.
 * For Pro users, all models are available (uses backend API keys).
 * For Free users, only shows models for providers where they've provided an API key.
 */

import { AVAILABLE_MODELS, type AIModel, type ModelProvider } from "./apiKeyStorage";
import { hasApiKey } from "./apiKeyStorage";
import { hasClaudeApiKey } from "./apiKeyStorage.claude";
import { hasGrokApiKey } from "./apiKeyStorage.grok";

/**
 * Get which providers the user has API keys for
 * @param userTier - Optional user tier ('free' | 'pro')
 */
export function getAvailableProviders(userTier?: "free" | "pro"): ModelProvider[] {
  // Pro users have access to all providers via backend API keys
  if (userTier === "pro") {
    return ["openai", "claude", "grok"];
  }

  // Free users only get models for providers they have API keys for
  const providers: ModelProvider[] = [];

  if (hasApiKey()) {
    providers.push("openai");
  }

  if (hasClaudeApiKey()) {
    providers.push("claude");
  }

  if (hasGrokApiKey()) {
    providers.push("grok");
  }

  return providers;
}

/**
 * Get all models that the user has access to based on their API keys or tier
 * @param userTier - Optional user tier ('free' | 'pro')
 */
export function getAvailableModels(userTier?: "free" | "pro"): typeof AVAILABLE_MODELS {
  const availableProviders = getAvailableProviders(userTier);

  // Filter models to only include those from providers the user has access to
  return AVAILABLE_MODELS.filter((model) =>
    availableProviders.includes(model.provider)
  );
}

/**
 * Check if the user has access to a specific model
 */
export function hasAccessToModel(model: AIModel): boolean {
  const availableProviders = getAvailableProviders();
  const modelInfo = AVAILABLE_MODELS.find((m) => m.value === model);

  if (!modelInfo) return false;

  return availableProviders.includes(modelInfo.provider);
}

/**
 * Check if the user has any API keys configured
 */
export function hasAnyApiKey(): boolean {
  return hasApiKey() || hasClaudeApiKey() || hasGrokApiKey();
}
