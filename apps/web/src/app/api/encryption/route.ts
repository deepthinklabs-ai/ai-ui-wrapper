/**
 * Encryption API
 *
 * Manages encryption key bundles and recovery codes for users.
 *
 * Routes:
 * - GET /api/encryption - Get user's encryption bundle (if exists)
 * - POST /api/encryption - Save encryption bundle and recovery codes
 * - PUT /api/encryption/recovery - Update recovery bundle (mark codes as used)
 */

import { NextResponse } from "next/server";
import { getAuthenticatedSupabaseClient } from "@/lib/serverAuth";
import { standardRatelimit, rateLimitErrorResponse } from "@/lib/ratelimit";
import { headers } from "next/headers";

interface EncryptionBundle {
  salt: string;
  wrappedDataKey: string;
  wrappedKeyIV: string;
}

interface RecoveryCodeBundle {
  codeHashes: string[];
  wrappedKeys: {
    codeHash: string;
    wrappedKey: string;
    salt: string;
    iv: string;
  }[];
  createdAt: string;
  usedCodes: string[];
}

interface UserProfile {
  encryption_bundle: EncryptionBundle | null;
  recovery_codes_bundle: RecoveryCodeBundle | null;
  encryption_setup_at: string | null;
  recovery_codes_delivery_method: string | null;
}

/**
 * GET /api/encryption
 * Get user's encryption bundle and recovery codes status
 */
export async function GET(request: Request) {
  // SECURITY: Require authentication
  const { supabase, user, error: authError } = await getAuthenticatedSupabaseClient(request);

  if (authError || !supabase || !user) {
    return NextResponse.json(
      { error: authError || "Unauthorized - Authentication required" },
      { status: 401 }
    );
  }

  try {
    // Rate limiting
    const rateLimitResult = standardRatelimit(`encryption-get-${user.id}`);
    if (!rateLimitResult.success) {
      return NextResponse.json(rateLimitErrorResponse(rateLimitResult), { status: 429 });
    }

    // Fetch user's encryption settings
    const { data: profile, error } = await supabase
      .from("user_profiles")
      .select("encryption_bundle, recovery_codes_bundle, encryption_setup_at, recovery_codes_delivery_method")
      .eq("id", user.id)
      .single();

    if (error && error.code !== "PGRST116") { // PGRST116 = no rows found
      console.error("[Encryption API] Error fetching profile:", error);
      return NextResponse.json(
        { error: "Failed to fetch encryption settings" },
        { status: 500 }
      );
    }

    const typedProfile = profile as UserProfile | null;

    if (!typedProfile?.encryption_bundle) {
      return NextResponse.json({
        hasEncryption: false,
        keyBundle: null,
        recoveryCodesStatus: null,
      });
    }

    // Calculate remaining recovery codes
    const recoveryBundle = typedProfile.recovery_codes_bundle;
    const remainingCodes = recoveryBundle
      ? recoveryBundle.codeHashes.length - recoveryBundle.usedCodes.length
      : 0;

    return NextResponse.json({
      hasEncryption: true,
      keyBundle: typedProfile.encryption_bundle,
      recoveryBundle: recoveryBundle,
      recoveryCodesStatus: {
        total: recoveryBundle?.codeHashes?.length || 0,
        remaining: remainingCodes,
        deliveryMethod: typedProfile.recovery_codes_delivery_method,
        setupAt: typedProfile.encryption_setup_at,
      },
    });
  } catch (error) {
    console.error("[Encryption API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/encryption
 * Save encryption bundle and recovery codes
 */
export async function POST(request: Request) {
  // SECURITY: Require authentication
  const { supabase, user, error: authError } = await getAuthenticatedSupabaseClient(request);

  if (authError || !supabase || !user) {
    return NextResponse.json(
      { error: authError || "Unauthorized - Authentication required" },
      { status: 401 }
    );
  }

  try {
    // Rate limiting (stricter for setup)
    const headersList = await headers();
    const rateLimitResult = standardRatelimit(`encryption-setup-${user.id}`);
    if (!rateLimitResult.success) {
      return NextResponse.json(rateLimitErrorResponse(rateLimitResult), { status: 429 });
    }

    const body = await request.json();
    const { keyBundle, recoveryBundle, deliveryMethod } = body;

    // Validate input
    if (!keyBundle?.salt || !keyBundle?.wrappedDataKey || !keyBundle?.wrappedKeyIV) {
      return NextResponse.json(
        { error: "Invalid key bundle" },
        { status: 400 }
      );
    }

    if (!recoveryBundle?.codeHashes || !recoveryBundle?.wrappedKeys) {
      return NextResponse.json(
        { error: "Invalid recovery bundle" },
        { status: 400 }
      );
    }

    // Save to user profile (using type assertion for new columns)
    const updateData = {
      encryption_bundle: keyBundle,
      recovery_codes_bundle: recoveryBundle,
      recovery_codes_delivery_method: deliveryMethod,
      encryption_setup_at: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("user_profiles")
      // @ts-ignore - New columns not yet in generated Supabase types
      .update(updateData)
      .eq("id", user.id);

    if (updateError) {
      console.error("[Encryption API] Error saving bundle:", updateError);
      return NextResponse.json(
        { error: "Failed to save encryption settings" },
        { status: 500 }
      );
    }

    // Log the setup event
    await logEncryptionEvent(supabase, user.id, "encryption_setup", {
      deliveryMethod,
      recoveryCodesCount: recoveryBundle.codeHashes.length,
    }, headersList);

    return NextResponse.json({
      success: true,
      message: "Encryption enabled successfully",
    });
  } catch (error) {
    console.error("[Encryption API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/encryption
 * Update encryption settings (e.g., mark recovery codes as used)
 */
export async function PUT(request: Request) {
  // SECURITY: Require authentication
  const { supabase, user, error: authError } = await getAuthenticatedSupabaseClient(request);

  if (authError || !supabase || !user) {
    return NextResponse.json(
      { error: authError || "Unauthorized - Authentication required" },
      { status: 401 }
    );
  }

  try {
    // Rate limiting
    const headersList = await headers();
    const rateLimitResult = standardRatelimit(`encryption-update-${user.id}`);
    if (!rateLimitResult.success) {
      return NextResponse.json(rateLimitErrorResponse(rateLimitResult), { status: 429 });
    }

    const body = await request.json();
    const { action, recoveryBundle, usedCodeHash } = body;

    if (action === "mark_code_used") {
      if (!recoveryBundle || !usedCodeHash) {
        return NextResponse.json(
          { error: "Missing required fields" },
          { status: 400 }
        );
      }

      // Update the recovery bundle
      const updateData = {
        recovery_codes_bundle: recoveryBundle,
      };

      const { error: updateError } = await supabase
        .from("user_profiles")
        // @ts-ignore - New columns not yet in generated Supabase types
        .update(updateData)
        .eq("id", user.id);

      if (updateError) {
        console.error("[Encryption API] Error updating bundle:", updateError);
        return NextResponse.json(
          { error: "Failed to update recovery codes" },
          { status: 500 }
        );
      }

      // Log the recovery event
      await logEncryptionEvent(supabase, user.id, "recovery_code_used", {
        codeHashPrefix: usedCodeHash.substring(0, 8) + "...",
        remainingCodes: recoveryBundle.codeHashes.length - recoveryBundle.usedCodes.length,
      }, headersList);

      return NextResponse.json({
        success: true,
        remainingCodes: recoveryBundle.codeHashes.length - recoveryBundle.usedCodes.length,
      });
    }

    return NextResponse.json(
      { error: "Unknown action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Encryption API] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Helper: Log encryption event to audit table
 */
async function logEncryptionEvent(
  supabase: any,
  userId: string,
  eventType: string,
  eventData: object,
  headersList: Headers
): Promise<void> {
  try {
    const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || null;
    const userAgent = headersList.get("user-agent") || null;

    await supabase.from("encryption_audit_log").insert({
      user_id: userId,
      event_type: eventType,
      event_data: eventData,
      ip_address: ip,
      user_agent: userAgent,
    });
  } catch (error) {
    // Don't fail the main request if audit logging fails
    console.error("[Encryption API] Failed to log event:", error);
  }
}
