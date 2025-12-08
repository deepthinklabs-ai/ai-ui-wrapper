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
 * Get which providers the user has access to
 * @param userTier - Optional user tier ('trial' | 'pro' | 'expired')
 */
export function getAvailableProviders(userTier?: "trial" | "pro" | "expired"): ModelProvider[] {
  // All users (trial and pro) have access to all providers via backend API keys
  // Expired users are blocked at API level, but UI still shows all providers
  return ["openai", "claude", "grok"];
}

/**
 * Get all models that the user has access to based on their tier
 * @param userTier - Optional user tier ('trial' | 'pro' | 'expired')
 */
export function getAvailableModels(userTier?: "trial" | "pro" | "expired"): typeof AVAILABLE_MODELS {
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
