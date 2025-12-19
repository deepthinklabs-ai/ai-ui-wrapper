"use client";

import { useCallback, useEffect, useState } from "react";

const CSRF_COOKIE_NAME = "csrf-token";

/**
 * Get CSRF token from cookie
 */
function getCSRFTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === CSRF_COOKIE_NAME) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Hook to access CSRF token for including in API requests
 *
 * Usage:
 * ```tsx
 * const { csrfToken, csrfFetch } = useCSRF();
 *
 * // Option 1: Use csrfFetch (recommended)
 * const response = await csrfFetch('/api/byok/store', {
 *   method: 'POST',
 *   body: JSON.stringify({ provider: 'openai', apiKey: 'xxx' }),
 * });
 *
 * // Option 2: Manual header inclusion
 * const response = await fetch('/api/byok/store', {
 *   method: 'POST',
 *   headers: {
 *     'Content-Type': 'application/json',
 *     'X-CSRF-Token': csrfToken,
 *   },
 *   body: JSON.stringify({ provider: 'openai', apiKey: 'xxx' }),
 * });
 * ```
 */
export function useCSRF() {
  const [csrfToken, setCSRFToken] = useState<string | null>(null);

  useEffect(() => {
    // Get token from cookie on mount
    const token = getCSRFTokenFromCookie();
    setCSRFToken(token);

    // Re-check periodically in case cookie is refreshed
    const interval = setInterval(() => {
      const newToken = getCSRFTokenFromCookie();
      if (newToken !== csrfToken) {
        setCSRFToken(newToken);
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [csrfToken]);

  /**
   * Fetch wrapper that automatically includes CSRF token
   */
  const csrfFetch = useCallback(
    async (url: string, options: RequestInit = {}): Promise<Response> => {
      const token = getCSRFTokenFromCookie();

      const headers = new Headers(options.headers);

      // Add CSRF token header for mutation requests
      const method = (options.method || "GET").toUpperCase();
      if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
        if (token) {
          headers.set("X-CSRF-Token", token);
        }
      }

      // Ensure Content-Type is set for JSON requests
      if (options.body && typeof options.body === "string") {
        if (!headers.has("Content-Type")) {
          headers.set("Content-Type", "application/json");
        }
      }

      return fetch(url, {
        ...options,
        headers,
      });
    },
    []
  );

  return {
    csrfToken,
    csrfFetch,
  };
}

/**
 * Get CSRF token synchronously (for use outside React components)
 */
export function getCSRFToken(): string | null {
  return getCSRFTokenFromCookie();
}

/**
 * Create fetch options with CSRF token included
 */
export function withCSRFToken(options: RequestInit = {}): RequestInit {
  const token = getCSRFTokenFromCookie();
  if (!token) return options;

  const headers = new Headers(options.headers);
  headers.set("X-CSRF-Token", token);

  return {
    ...options,
    headers,
  };
}
