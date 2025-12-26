/**
 * @security-audit-requested
 * AUDIT FOCUS: Server-side authentication
 * - Is the JWT token properly validated?
 * - Can tokens be forged or tampered with?
 * - Are expired tokens properly rejected?
 * - Is the token extraction secure (no injection)?
 * - Is the Supabase client correctly configured for auth verification?
 */

/**
 * Server-side Authentication Helper
 *
 * Utilities for verifying Supabase authentication on API routes.
 * Supports both user Bearer tokens and internal service authentication
 * for server-to-server calls.
 */

import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

// Internal service auth header name
const INTERNAL_SERVICE_HEADER = "x-internal-service-key";

export type AuthResult = {
  user: User | null;
  error?: string;
  isInternalCall?: boolean;
};

/**
 * Timing-safe string comparison to prevent timing attacks
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    let result = 0;
    const minLen = Math.min(a.length, b.length);
    for (let i = 0; i < minLen; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return false;
  }
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verify internal service authentication
 * Used for server-to-server calls from trusted routes (workflow trigger, ask-answer)
 *
 * SECURITY: Uses SUPABASE_SERVICE_ROLE_KEY as the shared secret.
 * Only server-side code can access this env var.
 */
export function verifyInternalServiceAuth(request: Request): boolean {
  const serviceKey = request.headers.get(INTERNAL_SERVICE_HEADER);
  const expectedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey || !expectedKey) {
    return false;
  }

  return timingSafeCompare(serviceKey, expectedKey);
}

/**
 * Get authenticated user from request headers
 * Expects Authorization: Bearer <token> header
 */
export async function getAuthenticatedUser(
  request: Request
): Promise<AuthResult> {
  // Get auth token from request headers
  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      user: null,
      error: "Missing or invalid authorization header",
    };
  }

  // SECURITY: Use substring instead of replace to prevent injection attacks
  // (e.g., "Bearer Bearer malicious" would leave "Bearer malicious" with replace)
  const token = authHeader.substring(7);

  // Create Supabase client with the user's token
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );

  // Verify the user is authenticated
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      user: null,
      error: authError?.message || "Invalid or expired token",
    };
  }

  return { user };
}

/**
 * Create authenticated Supabase client for API routes
 */
export async function getAuthenticatedSupabaseClient(request: Request): Promise<{
  supabase: ReturnType<typeof createClient> | null;
  user: User | null;
  error?: string;
}> {
  const authResult = await getAuthenticatedUser(request);

  if (authResult.error || !authResult.user) {
    return {
      supabase: null,
      user: null,
      error: authResult.error,
    };
  }

  const authHeader = request.headers.get("authorization");
  // SECURITY: Use substring instead of replace to prevent injection
  const token = authHeader!.substring(7);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );

  return {
    supabase: supabase as any,
    user: authResult.user,
  };
}

/**
 * Get authenticated user or verify internal service call
 *
 * Tries authentication in this order:
 * 1. User Bearer token (for direct client calls)
 * 2. Internal service key (for server-to-server calls)
 *
 * For internal calls, a synthetic user object is created with the userId from the request body.
 *
 * @param request - The incoming request
 * @param bodyUserId - The userId from the request body (required for internal calls)
 */
export async function getAuthenticatedUserOrService(
  request: Request,
  bodyUserId?: string
): Promise<AuthResult> {
  // First, try user Bearer token authentication
  const authHeader = request.headers.get("authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const result = await getAuthenticatedUser(request);
    if (result.user) {
      return result;
    }
    // If Bearer token failed but we have internal service auth, continue to try that
  }

  // Second, try internal service authentication
  if (verifyInternalServiceAuth(request)) {
    if (!bodyUserId) {
      return {
        user: null,
        error: "Internal service call requires userId in request body",
      };
    }

    // Verify the user exists in the database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Note: user_profiles table only has id, tier, created_at, updated_at
    // Email is in auth.users, but we don't need it for internal service calls
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("id", bodyUserId)
      .single();

    if (profileError || !profile) {
      console.error(`[serverAuth] User not found: ${bodyUserId}, error:`, profileError?.message);
      return {
        user: null,
        error: "User not found",
      };
    }

    // Return a synthetic user object for internal calls
    // Email is not available in user_profiles, use empty string
    return {
      user: {
        id: profile.id,
        email: "",
        // Minimal user object for internal calls
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: "",
      } as User,
      isInternalCall: true,
    };
  }

  // Neither auth method worked
  return {
    user: null,
    error: "Missing or invalid authorization",
  };
}

/**
 * Header name for internal service authentication
 * Export for use in routes making internal calls
 */
export const INTERNAL_SERVICE_AUTH_HEADER = INTERNAL_SERVICE_HEADER;
