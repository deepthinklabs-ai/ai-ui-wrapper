/**
 * Admin Authentication Helper
 *
 * Verifies that the authenticated user has admin privileges.
 * Must be used in conjunction with getAuthenticatedUser().
 *
 * Usage:
 *   import { requireAdmin } from '@/lib/adminAuth';
 *
 *   export async function GET(req: NextRequest) {
 *     const { result, errorResponse } = await requireAdmin(req);
 *     if (errorResponse) return errorResponse;
 *     // User is authenticated and is an admin
 *   }
 */

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "./serverAuth";
import type { User } from "@supabase/supabase-js";

export type AdminAuthResult = {
  user: User | null;
  isAdmin: boolean;
  adminEmail?: string;
  error?: string;
};

/**
 * Get authenticated admin user from request
 * Returns isAdmin: false if user exists but is not admin
 * Returns error if user is not authenticated
 */
export async function getAuthenticatedAdmin(
  request: Request
): Promise<AdminAuthResult> {
  // First, verify user is authenticated
  const authResult = await getAuthenticatedUser(request);

  if (authResult.error || !authResult.user) {
    return {
      user: null,
      isAdmin: false,
      error: authResult.error || "Unauthorized",
    };
  }

  // Check admin status in user_profiles
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("user_profiles")
    .select("is_admin")
    .eq("id", authResult.user.id)
    .single();

  if (profileError) {
    console.error("[AdminAuth] Profile lookup error:", profileError.message);
    return {
      user: authResult.user,
      isAdmin: false,
      error: "Profile not found",
    };
  }

  return {
    user: authResult.user,
    isAdmin: profile?.is_admin === true,
    adminEmail: authResult.user.email,
  };
}

/**
 * Require admin access - returns error response if not admin
 *
 * Usage:
 *   const { result, errorResponse } = await requireAdmin(req);
 *   if (errorResponse) return errorResponse;
 */
export async function requireAdmin(request: Request): Promise<{
  result: AdminAuthResult;
  errorResponse?: NextResponse;
}> {
  const result = await getAuthenticatedAdmin(request);

  if (result.error || !result.user) {
    return {
      result,
      errorResponse: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  if (!result.isAdmin) {
    return {
      result,
      errorResponse: NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      ),
    };
  }

  return { result };
}
