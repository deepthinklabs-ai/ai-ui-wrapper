/**
 * @security-audit-requested
 * AUDIT FOCUS: API key validation security
 * - Does format validation prevent malicious input?
 * - Are test API calls exposing keys in logs/errors?
 * - Is error handling leaking sensitive information?
 * - Can validation be bypassed?
 */

/**
 * API Key Validation and Testing
 *
 * Validates key formats and tests them against provider APIs
 * before storing in Secret Manager.
 *
 * SECURITY:
 * - Keys are tested but never logged
 * - Test calls use minimal API operations
 * - Errors are sanitized to not expose key details
 */

import type { BYOKProvider } from './index';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface TestResult {
  success: boolean;
  error?: string;
}

// ============================================
// FORMAT VALIDATION
// ============================================

/**
 * Validate OpenAI API key format
 * Patterns: sk-... or sk-proj-...
 */
export function validateOpenAIKeyFormat(key: string): ValidationResult {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'API key is required' };
  }

  const trimmed = key.trim();

  if (trimmed.length < 20) {
    return { valid: false, error: 'API key is too short' };
  }

  // OpenAI keys start with sk- or sk-proj-
  if (!trimmed.startsWith('sk-')) {
    return { valid: false, error: 'OpenAI API keys should start with "sk-"' };
  }

  return { valid: true };
}

/**
 * Validate Claude (Anthropic) API key format
 * Pattern: sk-ant-...
 */
export function validateClaudeKeyFormat(key: string): ValidationResult {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'API key is required' };
  }

  const trimmed = key.trim();

  if (trimmed.length < 20) {
    return { valid: false, error: 'API key is too short' };
  }

  // Claude keys start with sk-ant-
  if (!trimmed.startsWith('sk-ant-')) {
    return { valid: false, error: 'Claude API keys should start with "sk-ant-"' };
  }

  return { valid: true };
}

/**
 * Validate Grok (xAI) API key format
 * Pattern: xai-...
 */
export function validateGrokKeyFormat(key: string): ValidationResult {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'API key is required' };
  }

  const trimmed = key.trim();

  if (trimmed.length < 20) {
    return { valid: false, error: 'API key is too short' };
  }

  // Grok keys start with xai-
  if (!trimmed.startsWith('xai-')) {
    return { valid: false, error: 'Grok API keys should start with "xai-"' };
  }

  return { valid: true };
}

/**
 * Validate Gemini (Google AI) API key format
 * Pattern: AIza...
 */
export function validateGeminiKeyFormat(key: string): ValidationResult {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'API key is required' };
  }

  const trimmed = key.trim();

  if (trimmed.length < 20) {
    return { valid: false, error: 'API key is too short' };
  }

  // Gemini keys start with AIza
  if (!trimmed.startsWith('AIza')) {
    return { valid: false, error: 'Gemini API keys should start with "AIza"' };
  }

  return { valid: true };
}

/**
 * Validate key format for any provider
 */
export function validateKeyFormat(provider: BYOKProvider, key: string): ValidationResult {
  switch (provider) {
    case 'openai':
      return validateOpenAIKeyFormat(key);
    case 'claude':
      return validateClaudeKeyFormat(key);
    case 'grok':
      return validateGrokKeyFormat(key);
    case 'gemini':
      return validateGeminiKeyFormat(key);
    default:
      return { valid: false, error: 'Unknown provider' };
  }
}

// ============================================
// API KEY TESTING
// ============================================

/**
 * Test OpenAI API key by calling /v1/models endpoint
 * This is a free call that doesn't consume tokens
 */
export async function testOpenAIKey(key: string): Promise<TestResult> {
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`,
      },
    });

    if (response.ok) {
      return { success: true };
    }

    if (response.status === 401) {
      return { success: false, error: 'Invalid API key' };
    }

    if (response.status === 429) {
      return { success: false, error: 'Rate limited. Please try again later.' };
    }

    return { success: false, error: 'Failed to validate API key' };
  } catch {
    return { success: false, error: 'Network error. Please check your connection.' };
  }
}

/**
 * Test Claude API key by calling the messages endpoint with minimal data
 */
export async function testClaudeKey(key: string): Promise<TestResult> {
  try {
    // Use a minimal request to test the key
    // This will fail quickly if the key is invalid
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      }),
    });

    // 200 = success, key is valid
    if (response.ok) {
      return { success: true };
    }

    // 401 = invalid key
    if (response.status === 401) {
      return { success: false, error: 'Invalid API key' };
    }

    // 429 = rate limited but key is valid
    if (response.status === 429) {
      return { success: true }; // Key works, just rate limited
    }

    // 400 could mean key is valid but request is bad (still validates key)
    if (response.status === 400) {
      const data = await response.json().catch(() => ({}));
      // Check if it's an auth error vs other error
      if (data.error?.type === 'authentication_error') {
        return { success: false, error: 'Invalid API key' };
      }
      // Other 400 errors mean the key authenticated successfully
      return { success: true };
    }

    return { success: false, error: 'Failed to validate API key' };
  } catch {
    return { success: false, error: 'Network error. Please check your connection.' };
  }
}

/**
 * Test Grok API key by calling the models endpoint
 */
export async function testGrokKey(key: string): Promise<TestResult> {
  try {
    const response = await fetch('https://api.x.ai/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${key}`,
      },
    });

    if (response.ok) {
      return { success: true };
    }

    if (response.status === 401) {
      return { success: false, error: 'Invalid API key' };
    }

    if (response.status === 429) {
      return { success: true }; // Key works, just rate limited
    }

    return { success: false, error: 'Failed to validate API key' };
  } catch {
    return { success: false, error: 'Network error. Please check your connection.' };
  }
}

/**
 * Test Gemini API key by calling the models endpoint
 */
export async function testGeminiKey(key: string): Promise<TestResult> {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models?key=${key}`,
      {
        method: 'GET',
      }
    );

    if (response.ok) {
      return { success: true };
    }

    if (response.status === 400 || response.status === 401 || response.status === 403) {
      return { success: false, error: 'Invalid API key' };
    }

    if (response.status === 429) {
      return { success: true }; // Key works, just rate limited
    }

    return { success: false, error: 'Failed to validate API key' };
  } catch {
    return { success: false, error: 'Network error. Please check your connection.' };
  }
}

/**
 * Test API key for any provider
 */
export async function testApiKey(provider: BYOKProvider, key: string): Promise<TestResult> {
  // First validate format
  const formatResult = validateKeyFormat(provider, key);
  if (!formatResult.valid) {
    return { success: false, error: formatResult.error };
  }

  // Then test with provider API
  switch (provider) {
    case 'openai':
      return testOpenAIKey(key.trim());
    case 'claude':
      return testClaudeKey(key.trim());
    case 'grok':
      return testGrokKey(key.trim());
    case 'gemini':
      return testGeminiKey(key.trim());
    default:
      return { success: false, error: 'Unknown provider' };
  }
}
