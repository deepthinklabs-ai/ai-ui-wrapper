/**
 * Claude API Key Storage Utility
 *
 * Manages Anthropic Claude API key storage in browser localStorage.
 * Keys are NEVER sent to our backend - only stored client-side.
 */

const CLAUDE_API_KEY_STORAGE_KEY = 'claude_api_key';

/**
 * Get the stored Claude API key from localStorage
 */
export function getClaudeApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(CLAUDE_API_KEY_STORAGE_KEY);
}

/**
 * Save Claude API key to localStorage
 */
export function setClaudeApiKey(apiKey: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CLAUDE_API_KEY_STORAGE_KEY, apiKey.trim());
}

/**
 * Remove Claude API key from localStorage
 */
export function clearClaudeApiKey(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CLAUDE_API_KEY_STORAGE_KEY);
}

/**
 * Check if a Claude API key is currently stored
 */
export function hasClaudeApiKey(): boolean {
  const key = getClaudeApiKey();
  return key !== null && key.length > 0;
}
