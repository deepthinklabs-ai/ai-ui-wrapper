/**
 * URL Sanitization Utilities
 *
 * Validates and sanitizes URLs to prevent XSS attacks via dangerous schemes.
 */

/**
 * Allowed URL schemes for images
 */
const ALLOWED_IMAGE_SCHEMES = ['https:', 'http:', 'data:'];

/**
 * Allowed data URL MIME types for images
 * Note: SVG is intentionally excluded as it can contain <script> tags and event handlers
 */
const ALLOWED_DATA_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
];

/**
 * Sanitize an image URL to prevent XSS (CWE-79)
 *
 * Only allows https, http, or data: URLs with valid image MIME types.
 * Returns undefined for invalid/dangerous URLs.
 *
 * @param url - The URL to sanitize
 * @returns Sanitized URL or undefined if invalid
 */
export function sanitizeImageUrl(url: string | undefined | null): string | undefined {
  if (!url || typeof url !== 'string') {
    return undefined;
  }

  try {
    // Handle data: URLs specially
    if (url.startsWith('data:')) {
      // Validate it's an allowed image MIME type
      const mimeMatch = url.match(/^data:([^;,]+)/);
      if (mimeMatch) {
        const mimeType = mimeMatch[1].toLowerCase();
        if (ALLOWED_DATA_MIME_TYPES.includes(mimeType)) {
          return url;
        }
      }
      return undefined;
    }

    // Parse and validate URL
    const parsed = new URL(url);

    // Only allow safe schemes
    if (!ALLOWED_IMAGE_SCHEMES.includes(parsed.protocol)) {
      return undefined;
    }

    // Return the validated URL
    return parsed.href;
  } catch {
    // Invalid URL
    return undefined;
  }
}

/**
 * Sanitize a general URL to prevent XSS
 *
 * Only allows https and http schemes.
 * Returns undefined for invalid/dangerous URLs.
 *
 * @param url - The URL to sanitize
 * @returns Sanitized URL or undefined if invalid
 */
export function sanitizeUrl(url: string | undefined | null): string | undefined {
  if (!url || typeof url !== 'string') {
    return undefined;
  }

  try {
    const parsed = new URL(url);

    // Only allow http/https
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return undefined;
    }

    return parsed.href;
  } catch {
    return undefined;
  }
}
