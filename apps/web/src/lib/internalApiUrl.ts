/**
 * Internal API URL Utility
 *
 * Safely constructs URLs for internal API calls, preventing SSRF attacks
 * by using only trusted environment variables for URL construction.
 *
 * SECURITY: This module intentionally does NOT use any request-derived values
 * to construct URLs, preventing SSRF attacks via Host header manipulation.
 */

/**
 * Vercel Protection Bypass header name
 * Used to bypass Vercel Deployment Protection for internal server-to-server calls
 */
export const VERCEL_PROTECTION_BYPASS_HEADER = 'x-vercel-protection-bypass';

/**
 * Get headers needed to bypass Vercel Deployment Protection
 * Returns empty object if bypass secret is not configured
 */
export function getVercelBypassHeaders(): Record<string, string> {
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (bypassSecret) {
    return { [VERCEL_PROTECTION_BYPASS_HEADER]: bypassSecret };
  }
  return {};
}

/**
 * Allowed internal API endpoints (whitelist)
 */
const ALLOWED_INTERNAL_ENDPOINTS = [
  '/api/pro/openai',
  '/api/pro/claude',
  '/api/pro/grok',
  '/api/pro/gemini',
] as const;

/**
 * Get a safe base URL for internal API calls
 *
 * SECURITY: Only uses trusted environment variables, never request-derived values.
 * This prevents SSRF attacks via Host header manipulation.
 *
 * @returns Safe base URL for internal calls
 */
export function getInternalBaseUrl(): string {
  // Vercel preview deployments: Use VERCEL_URL to call the same deployment
  // This ensures staging/preview branches call themselves, not production
  // VERCEL_URL is set for ALL Vercel deployments (preview and production)
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // Fallback: Use configured app URL
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL;
  }

  // Development: Use PORT env var or default to 3000
  // SECURITY: Never derive from request.url to prevent SSRF
  const port = process.env.PORT || '3000';
  return `http://localhost:${port}`;
}

/**
 * Build a safe internal API URL
 *
 * @param endpoint - The API endpoint (must be in whitelist)
 * @returns Full URL for the internal API call
 * @throws Error if endpoint is not in whitelist
 */
export function buildInternalApiUrl(endpoint: string): string {
  // SECURITY: Validate endpoint against whitelist
  if (!ALLOWED_INTERNAL_ENDPOINTS.includes(endpoint as any)) {
    throw new Error(`Invalid internal API endpoint: ${endpoint}`);
  }

  const baseUrl = getInternalBaseUrl();
  return `${baseUrl}${endpoint}`;
}

/**
 * Type for allowed endpoints
 */
export type AllowedInternalEndpoint = typeof ALLOWED_INTERNAL_ENDPOINTS[number];
