/**
 * Available Models Utility
 *
 * Returns available AI models for users.
 * With BYOK (Bring Your Own Key), all models are shown since users configure
 * their own API keys server-side in Settings.
 */

import { AVAILABLE_MODELS, type AIModel, type ModelProvider } from "./apiKeyStorage";

/**
 * Get which providers are available
 * @param userTier - Optional user tier ('trial' | 'pro' | 'expired' | 'pending')
 */
export function getAvailableProviders(userTier?: "trial" | "pro" | "expired" | "pending"): ModelProvider[] {
  // BYOK: All providers are available - users configure their own keys
  return ["openai", "claude", "grok", "gemini"];
}

/**
 * Get all models that the user has access to based on their tier
 * @param userTier - Optional user tier ('trial' | 'pro' | 'expired' | 'pending')
 */
export function getAvailableModels(userTier?: "trial" | "pro" | "expired" | "pending"): typeof AVAILABLE_MODELS {
  // BYOK: All models are available - users configure their own keys
  // The API will return an error if they try to use a model without the key configured
  return AVAILABLE_MODELS;
}

/**
 * Check if the user has access to a specific model
 */
export function hasAccessToModel(model: AIModel): boolean {
  // BYOK: All models are accessible - API will check for key at request time
  const modelInfo = AVAILABLE_MODELS.find((m) => m.value === model);
  return !!modelInfo;
}
