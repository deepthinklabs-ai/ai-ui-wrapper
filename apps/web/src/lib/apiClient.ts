"use client";

/**
 * API Client with automatic CSRF protection
 *
 * This client automatically includes CSRF tokens for all mutation requests.
 * Use this instead of raw fetch() for API calls to ensure CSRF protection.
 *
 * Usage:
 * ```ts
 * import { apiClient } from '@/lib/apiClient';
 *
 * // POST request (CSRF token automatically included)
 * const response = await apiClient.post('/api/byok/store', {
 *   provider: 'openai',
 *   apiKey: 'xxx',
 * });
 *
 * // GET request (no CSRF needed)
 * const data = await apiClient.get('/api/byok/status');
 *
 * // With custom headers
 * const response = await apiClient.post('/api/endpoint', data, {
 *   headers: { 'X-Custom-Header': 'value' },
 * });
 * ```
 */

const CSRF_COOKIE_NAME = "csrf-token";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Get CSRF token from cookie
 */
function getCSRFToken(): string | null {
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

type RequestOptions = Omit<RequestInit, "method" | "body"> & {
  headers?: Record<string, string>;
};

type ApiResponse<T> = {
  data: T | null;
  error: string | null;
  status: number;
  ok: boolean;
};

/**
 * Make an API request with automatic CSRF protection
 */
async function request<T = unknown>(
  url: string,
  method: string,
  body?: unknown,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    ...options.headers,
  };

  // Add CSRF token for mutation requests
  if (["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase())) {
    const csrfToken = getCSRFToken();
    if (csrfToken) {
      headers[CSRF_HEADER_NAME] = csrfToken;
    }
  }

  // Add Content-Type for JSON body (only if not already set)
  if (body !== undefined && body !== null) {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }

  try {
    const response = await fetch(url, {
      ...options,
      method,
      headers,
      body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
    });

    // Try to parse JSON response
    let data: T | null = null;
    let error: string | null = null;

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      const json = await response.json();
      if (response.ok) {
        data = json as T;
      } else {
        error = json.error || json.message || "Request failed";
      }
    } else if (!response.ok) {
      error = await response.text() || "Request failed";
    }

    return {
      data,
      error,
      status: response.status,
      ok: response.ok,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err.message : "Network error",
      status: 0,
      ok: false,
    };
  }
}

/**
 * API client with CSRF protection
 */
export const apiClient = {
  /**
   * GET request (no CSRF token needed)
   */
  get: <T = unknown>(url: string, options?: RequestOptions) =>
    request<T>(url, "GET", undefined, options),

  /**
   * POST request (CSRF token automatically included)
   */
  post: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>(url, "POST", body, options),

  /**
   * PUT request (CSRF token automatically included)
   */
  put: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>(url, "PUT", body, options),

  /**
   * DELETE request (CSRF token automatically included)
   */
  delete: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>(url, "DELETE", body, options),

  /**
   * PATCH request (CSRF token automatically included)
   */
  patch: <T = unknown>(url: string, body?: unknown, options?: RequestOptions) =>
    request<T>(url, "PATCH", body, options),

  /**
   * Raw fetch with CSRF token (for special cases like FormData)
   */
  fetch: async (url: string, options: RequestInit = {}): Promise<Response> => {
    const method = (options.method || "GET").toUpperCase();
    const headers = new Headers(options.headers);

    // Add CSRF token for mutation requests
    if (["POST", "PUT", "DELETE", "PATCH"].includes(method)) {
      const csrfToken = getCSRFToken();
      if (csrfToken) {
        headers.set(CSRF_HEADER_NAME, csrfToken);
      }
    }

    return fetch(url, {
      ...options,
      headers,
    });
  },
};

/**
 * Get authorization headers with bearer token
 */
export function getAuthHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const csrfToken = getCSRFToken();
  if (csrfToken) {
    headers[CSRF_HEADER_NAME] = csrfToken;
  }

  return headers;
}
