/**
 * SSM Agent Input Sanitization & Security
 *
 * Provides security utilities for SSM agent operations:
 * - Input sanitization to prevent injection attacks
 * - URL validation to prevent SSRF
 * - Content length limits
 * - Rate limiting helpers
 *
 * Security considerations:
 * - All user inputs are sanitized before use
 * - Ollama endpoints are validated against allowlist
 * - Prompt injection patterns are detected and blocked
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Maximum allowed lengths for various inputs
 */
export const INPUT_LIMITS = {
  EVENT_CONTENT: 50000,      // 50KB max event content
  CUSTOM_PROMPT: 5000,       // 5KB max custom prompt
  NODE_NAME: 100,            // 100 chars max node name
  DESCRIPTION: 500,          // 500 chars max description
  WEBHOOK_SECRET: 256,       // 256 chars max webhook secret
  ALERT_WEBHOOK_URL: 2048,   // 2KB max URL length
} as const;

/**
 * Allowed Ollama endpoint patterns (localhost and common local network)
 * Prevents SSRF attacks by restricting to known-safe endpoints
 */
const ALLOWED_ENDPOINT_PATTERNS = [
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
  /^https?:\/\/0\.0\.0\.0(:\d+)?$/,
  /^https?:\/\/host\.docker\.internal(:\d+)?$/,
  /^https?:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^https?:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^https?:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
];

/**
 * Patterns that may indicate prompt injection attempts
 */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/i,
  /disregard\s+(all\s+)?(previous|prior|above)/i,
  /you\s+are\s+now\s+(a|an)\s+/i,
  /new\s+instructions?:/i,
  /system\s*:\s*/i,
  /\[INST\]/i,
  /\[\/INST\]/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
];

// ============================================================================
// TYPES
// ============================================================================

export interface SanitizationResult {
  isValid: boolean;
  sanitized: string;
  warnings: string[];
  blocked: boolean;
  blockReason?: string;
}

export interface EndpointValidationResult {
  isValid: boolean;
  normalizedUrl?: string;
  error?: string;
}

// ============================================================================
// SANITIZATION FUNCTIONS
// ============================================================================

/**
 * Sanitize event content for SSM processing
 * Removes potentially dangerous content while preserving meaning
 */
export function sanitizeEventContent(content: string): SanitizationResult {
  const warnings: string[] = [];
  let sanitized = content;
  let blocked = false;
  let blockReason: string | undefined;

  // Check length limit
  if (content.length > INPUT_LIMITS.EVENT_CONTENT) {
    sanitized = content.slice(0, INPUT_LIMITS.EVENT_CONTENT);
    warnings.push(`Content truncated to ${INPUT_LIMITS.EVENT_CONTENT} characters`);
  }

  // Check for injection patterns
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      blocked = true;
      blockReason = 'Potential prompt injection detected';
      break;
    }
  }

  // Remove null bytes and other control characters (except newlines, tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Normalize whitespace (multiple spaces/newlines to single)
  sanitized = sanitized.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n');

  return {
    isValid: !blocked,
    sanitized: blocked ? '' : sanitized.trim(),
    warnings,
    blocked,
    blockReason,
  };
}

/**
 * Sanitize custom prompts provided by users
 * More strict than event content sanitization
 */
export function sanitizeCustomPrompt(prompt: string): SanitizationResult {
  const warnings: string[] = [];
  let sanitized = prompt;
  let blocked = false;
  let blockReason: string | undefined;

  // Check length limit
  if (prompt.length > INPUT_LIMITS.CUSTOM_PROMPT) {
    sanitized = prompt.slice(0, INPUT_LIMITS.CUSTOM_PROMPT);
    warnings.push(`Prompt truncated to ${INPUT_LIMITS.CUSTOM_PROMPT} characters`);
  }

  // Check for injection patterns (stricter for prompts)
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(sanitized)) {
      blocked = true;
      blockReason = 'Custom prompt contains disallowed patterns';
      break;
    }
  }

  // Remove potentially dangerous characters
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  return {
    isValid: !blocked,
    sanitized: blocked ? '' : sanitized.trim(),
    warnings,
    blocked,
    blockReason,
  };
}

/**
 * Validate and normalize Ollama endpoint URL
 * Prevents SSRF by only allowing local/trusted endpoints
 */
export function validateOllamaEndpoint(endpoint: string): EndpointValidationResult {
  // Remove trailing slash for consistency
  const normalizedUrl = endpoint.replace(/\/+$/, '');

  // Check against allowed patterns
  const isAllowed = ALLOWED_ENDPOINT_PATTERNS.some(pattern => pattern.test(normalizedUrl));

  if (!isAllowed) {
    return {
      isValid: false,
      error: 'Ollama endpoint must be a local address (localhost, 127.0.0.1, or local network)',
    };
  }

  // Validate URL format
  try {
    const url = new URL(normalizedUrl);

    // Only allow http/https
    if (!['http:', 'https:'].includes(url.protocol)) {
      return {
        isValid: false,
        error: 'Ollama endpoint must use http or https protocol',
      };
    }

    return {
      isValid: true,
      normalizedUrl,
    };
  } catch {
    return {
      isValid: false,
      error: 'Invalid URL format for Ollama endpoint',
    };
  }
}

/**
 * Validate webhook URL for alert delivery
 */
export function validateWebhookUrl(url: string): EndpointValidationResult {
  if (url.length > INPUT_LIMITS.ALERT_WEBHOOK_URL) {
    return {
      isValid: false,
      error: `Webhook URL exceeds maximum length of ${INPUT_LIMITS.ALERT_WEBHOOK_URL}`,
    };
  }

  try {
    const parsed = new URL(url);

    // Only allow https for webhooks (security requirement)
    if (parsed.protocol !== 'https:') {
      return {
        isValid: false,
        error: 'Webhook URL must use HTTPS for security',
      };
    }

    // Block localhost for webhooks (doesn't make sense)
    if (['localhost', '127.0.0.1', '0.0.0.0'].includes(parsed.hostname)) {
      return {
        isValid: false,
        error: 'Webhook URL cannot be localhost',
      };
    }

    return {
      isValid: true,
      normalizedUrl: url,
    };
  } catch {
    return {
      isValid: false,
      error: 'Invalid webhook URL format',
    };
  }
}

/**
 * Sanitize node name
 */
export function sanitizeNodeName(name: string): string {
  return name
    .slice(0, INPUT_LIMITS.NODE_NAME)
    .replace(/[<>\"'&]/g, '') // Remove HTML-sensitive chars
    .trim();
}

/**
 * Generate a safe request ID for logging/tracing
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `ssm_${timestamp}_${random}`;
}

// ============================================================================
// RATE LIMITING HELPERS
// ============================================================================

/**
 * Rate limit key generator for SSM requests
 */
export function getRateLimitKey(userId: string, nodeId: string): string {
  return `ssm:${userId}:${nodeId}`;
}

/**
 * Global rate limit key for user
 */
export function getUserRateLimitKey(userId: string): string {
  return `ssm:user:${userId}`;
}
