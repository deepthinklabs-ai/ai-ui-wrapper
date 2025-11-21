/**
 * Grok API Key Storage Utility
 *
 * Manages xAI Grok API key storage in browser localStorage.
 * Keys are NEVER sent to our backend - only stored client-side.
 */

const GROK_API_KEY_STORAGE_KEY = 'grok_api_key';

/**
 * Get the stored Grok API key from localStorage
 */
export function getGrokApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(GROK_API_KEY_STORAGE_KEY);
}

/**
 * Save Grok API key to localStorage
 */
export function setGrokApiKey(apiKey: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(GROK_API_KEY_STORAGE_KEY, apiKey.trim());
}

/**
 * Remove Grok API key from localStorage
 */
export function clearGrokApiKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(GROK_API_KEY_STORAGE_KEY);
}

/**
 * Check if a Grok API key is currently stored
 */
export function hasGrokApiKey(): boolean {
  const key = getGrokApiKey();
  return key !== null && key.length > 0;
}
