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
 */

import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

export type AuthResult = {
  user: User | null;
  error?: string;
};

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
