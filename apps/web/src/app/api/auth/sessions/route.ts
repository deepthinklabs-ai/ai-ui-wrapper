import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { auditSession } from "@/lib/auditLog";
import { withDebug } from "@/lib/debug";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/auth/sessions
 * Get current user's session info
 */
export const GET = withDebug(async (req, sessionId) => {
  try {
    const { user, error: authError } = await getAuthenticatedUser(req);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Return basic session info
    // Note: Supabase doesn't expose session metadata directly,
    // but we can provide user info and session status
    return NextResponse.json({
      userId: user.id,
      email: user.email,
      lastSignInAt: user.last_sign_in_at,
      createdAt: user.created_at,
      // Session is valid if we got here (auth passed)
      sessionValid: true,
    });
  } catch (error: any) {
    console.error("[Sessions API] Error:", error.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/auth/sessions
 * Sign out user from all sessions (revoke all tokens)
 *
 * Query params:
 * - scope: "all" | "current" (default: "current")
 */
export const DELETE = withDebug(async (req, sessionId) => {
  try {
    const { user, error: authError } = await getAuthenticatedUser(req);

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const scope = searchParams.get("scope") || "current";

    if (scope === "all") {
      // Sign out from all devices/sessions
      // This uses the admin API to invalidate all refresh tokens
      const { error } = await supabaseAdmin.auth.admin.signOut(
        user.id,
        "global" // Invalidates all sessions
      );

      if (error) {
        console.error("[Sessions API] Error revoking all sessions:", error.message);
        return NextResponse.json(
          { error: "Failed to revoke sessions" },
          { status: 500 }
        );
      }

      // Audit: All sessions revoked
      await auditSession.revokedAll(user.id, { headers: req.headers });

      return NextResponse.json({
        success: true,
        message: "All sessions revoked successfully",
        scope: "all",
      });
    } else {
      // Sign out from current session only
      // This is typically handled client-side, but we provide an API endpoint
      const { error } = await supabaseAdmin.auth.admin.signOut(
        user.id,
        "local" // Only invalidates the current session
      );

      if (error) {
        console.error("[Sessions API] Error revoking current session:", error.message);
        return NextResponse.json(
          { error: "Failed to revoke session" },
          { status: 500 }
        );
      }

      // Audit: Current session revoked
      await auditSession.revoked(user.id, { headers: req.headers });

      return NextResponse.json({
        success: true,
        message: "Current session revoked successfully",
        scope: "current",
      });
    }
  } catch (error: any) {
    console.error("[Sessions API] Error:", error.message);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
