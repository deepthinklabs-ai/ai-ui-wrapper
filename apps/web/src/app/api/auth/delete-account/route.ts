/**
 * Account Deletion Endpoint
 *
 * Handles full account deletion with cascade cleanup:
 * 1. Cancel Stripe subscription
 * 2. Delete API keys from Secret Manager
 * 3. Delete OAuth connections
 * 4. Delete user from Supabase (cascades to other tables via RLS)
 *
 * This is an irreversible operation.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedUser } from "@/lib/serverAuth";
import { deleteAllUserKeys } from "@/lib/secretManager";
import { stripe } from "@/lib/stripe";
import { auditAuth } from "@/lib/auditLog";
import { strictRatelimitAsync, rateLimitErrorResponse } from "@/lib/ratelimit";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * DELETE /api/auth/delete-account
 *
 * Permanently deletes the user's account and all associated data.
 * Requires confirmation in request body.
 */
export async function DELETE(req: NextRequest) {
  try {
    // Rate limit: 3 attempts per minute (prevent abuse)
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rateLimitResult = await strictRatelimitAsync(`delete-account:${ip}`);
    if (!rateLimitResult.success) {
      return rateLimitErrorResponse(rateLimitResult);
    }

    // Authenticate user
    const { user, error: authError } = await getAuthenticatedUser(req);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Require explicit confirmation
    const body = await req.json().catch(() => ({}));
    if (body.confirm !== "DELETE_MY_ACCOUNT") {
      return NextResponse.json(
        {
          error: "Account deletion requires confirmation",
          hint: "Send { confirm: 'DELETE_MY_ACCOUNT' } in request body",
        },
        { status: 400 }
      );
    }

    const userId = user.id;
    const userEmail = user.email;
    const deletionResults: Record<string, "success" | "skipped" | "error"> = {};

    // Step 1: Cancel Stripe subscription if exists
    try {
      const { data: subscription } = await supabaseAdmin
        .from("subscriptions")
        .select("stripe_customer_id, stripe_subscription_id, status")
        .eq("user_id", userId)
        .single();

      if (subscription?.stripe_subscription_id && subscription.status === "active") {
        // Cancel subscription immediately
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        deletionResults.stripeSubscription = "success";
      } else {
        deletionResults.stripeSubscription = "skipped";
      }
    } catch (error) {
      console.error("[DeleteAccount] Stripe cancellation error:", error);
      deletionResults.stripeSubscription = "error";
      // Continue with deletion even if Stripe fails
    }

    // Step 2: Delete API keys from Secret Manager
    try {
      await deleteAllUserKeys(userId);
      deletionResults.apiKeys = "success";
    } catch (error) {
      console.error("[DeleteAccount] Secret Manager deletion error:", error);
      deletionResults.apiKeys = "error";
      // Continue with deletion even if Secret Manager fails
    }

    // Step 3: Delete OAuth connections (tokens are encrypted, delete from DB)
    try {
      await supabaseAdmin
        .from("oauth_connections")
        .delete()
        .eq("user_id", userId);
      deletionResults.oauthConnections = "success";
    } catch (error) {
      console.error("[DeleteAccount] OAuth deletion error:", error);
      deletionResults.oauthConnections = "error";
    }

    // Step 4: Delete user from Supabase Auth
    // This cascades to all tables with user_id foreign key (ON DELETE CASCADE)
    try {
      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(
        userId
      );

      if (deleteError) {
        throw deleteError;
      }
      deletionResults.user = "success";
    } catch (error) {
      console.error("[DeleteAccount] User deletion error:", error);
      return NextResponse.json(
        { error: "Failed to delete user account" },
        { status: 500 }
      );
    }

    // Audit log the deletion (use a system context since user is deleted)
    try {
      auditAuth.accountDeleted(
        {
          userId,
          email: userEmail,
          ip:
            req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            req.headers.get("x-real-ip") ||
            "unknown",
          userAgent: req.headers.get("user-agent") || undefined,
        },
        {
          deletionResults,
          deletedAt: new Date().toISOString(),
        }
      );
    } catch (auditError) {
      // Don't fail the request if audit logging fails
      console.error("[DeleteAccount] Audit logging error:", auditError);
    }

    return NextResponse.json({
      success: true,
      message: "Account has been permanently deleted",
      details: deletionResults,
    });
  } catch (error: any) {
    console.error("[DeleteAccount] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
