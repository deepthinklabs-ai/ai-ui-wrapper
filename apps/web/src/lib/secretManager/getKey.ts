/**
 * Internal Key Retrieval for API Proxy Routes
 *
 * This module provides a secure way to retrieve API keys for use in
 * backend proxy routes. Keys are fetched, used immediately, and should
 * be nulled out after use.
 *
 * SECURITY:
 * - This module is for SERVER-SIDE use only
 * - Never expose these functions to the client
 * - Never log the returned keys
 * - Null out key variables immediately after use
 */

import { getUserKeys, type BYOKProvider } from './index';

/**
 * Get a specific provider's API key for a user
 *
 * @param userId - The authenticated user's ID
 * @param provider - The provider to get the key for
 * @returns The API key or null if not configured
 *
 * IMPORTANT: After using the returned key, set your variable to null:
 * ```
 * let apiKey = await getProviderKey(userId, 'openai');
 * // use apiKey...
 * apiKey = null; // Clear from memory
 * ```
 */
export async function getProviderKey(
  userId: string,
  provider: BYOKProvider
): Promise<string | null> {
  if (!userId) {
    return null;
  }

  const keys = await getUserKeys(userId);
  const key = keys[provider];

  // Return key (caller is responsible for nulling after use)
  return key;
}

/**
 * Check if a user has a specific provider key configured
 * Use this to check before making API calls
 */
export async function hasProviderKey(
  userId: string,
  provider: BYOKProvider
): Promise<boolean> {
  const key = await getProviderKey(userId, provider);
  const hasKey = key !== null && key.length > 0;
  // Key variable goes out of scope here
  return hasKey;
}

/**
 * Get provider key with existence check
 * Throws descriptive error if key not configured
 */
export async function requireProviderKey(
  userId: string,
  provider: BYOKProvider
): Promise<string> {
  const key = await getProviderKey(userId, provider);

  if (!key) {
    const providerNames: Record<BYOKProvider, string> = {
      openai: 'OpenAI',
      claude: 'Claude (Anthropic)',
      grok: 'Grok (xAI)',
      gemini: 'Gemini (Google)',
    };

    throw new Error(
      `Please configure your ${providerNames[provider]} API key in Settings to use this model.`
    );
  }

  return key;
}
