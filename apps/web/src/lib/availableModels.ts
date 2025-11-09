/**
 * Available Models Utility
 *
 * Filters available AI models based on which API keys the user has configured.
 * Only shows models for providers where the user has provided an API key.
 */

import { AVAILABLE_MODELS, type AIModel, type ModelProvider } from "./apiKeyStorage";
import { hasApiKey } from "./apiKeyStorage";
import { hasClaudeApiKey } from "./apiKeyStorage.claude";

/**
 * Get which providers the user has API keys for
 */
export function getAvailableProviders(): ModelProvider[] {
  const providers: ModelProvider[] = [];

  if (hasApiKey()) {
    providers.push("openai");
  }

  if (hasClaudeApiKey()) {
    providers.push("claude");
  }

  return providers;
}

/**
 * Get all models that the user has access to based on their API keys
 */
export function getAvailableModels(): typeof AVAILABLE_MODELS {
  const availableProviders = getAvailableProviders();

  // Filter models to only include those from providers with API keys
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
  return hasApiKey() || hasClaudeApiKey();
}
