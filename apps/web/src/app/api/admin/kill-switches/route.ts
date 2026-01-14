/**
 * Admin Kill Switches API
 *
 * GET: Retrieve all kill switch states
 * PATCH: Toggle a specific kill switch
 *
 * Protected by admin authentication.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/adminAuth";
import {
  getAllKillSwitchStates,
  clearKillSwitchCache,
  type KillSwitchKey,
} from "@/lib/killSwitches";
import { notifyAllAdmins } from "@/lib/email";
import { logAuditEvent } from "@/lib/auditLog";
import { withDebug } from "@/lib/debug";

const VALID_KILL_SWITCHES: KillSwitchKey[] = [
  "master_kill_switch",
  "ai_features_enabled",
  "oauth_enabled",
  "new_signups_enabled",
  "payments_enabled",
];

// Human-readable names for email notifications
const SWITCH_NAMES: Record<KillSwitchKey, string> = {
  master_kill_switch: "Master Kill Switch",
  ai_features_enabled: "AI Features",
  oauth_enabled: "OAuth Connections",
  new_signups_enabled: "New User Signups",
  payments_enabled: "Payment Processing",
};

/**
 * GET: Retrieve all kill switch states
 */
export const GET = withDebug(async (req, sessionId) => {
  const { result, errorResponse } = await requireAdmin(req);
  if (errorResponse) return errorResponse;

  try {
    const states = await getAllKillSwitchStates();

    // Also get metadata (last updated, by whom)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: configs } = await supabase
      .from("system_config")
      .select("key, updated_at, updated_by, description")
      .in("key", VALID_KILL_SWITCHES);

    const enrichedStates = VALID_KILL_SWITCHES.map((key) => {
      const config = configs?.find((c) => c.key === key);
      return {
        key,
        name: SWITCH_NAMES[key],
        value: states[key],
        description: config?.description,
        updatedAt: config?.updated_at,
        updatedBy: config?.updated_by,
      };
    });

    return NextResponse.json({ switches: enrichedStates });
  } catch (error: any) {
    console.error("[Admin API] Error fetching kill switches:", error);
    return NextResponse.json(
      { error: "Failed to fetch kill switches" },
      { status: 500 }
    );
  }
});

/**
 * PATCH: Toggle a specific kill switch
 */
export const PATCH = withDebug(async (req, sessionId) => {
  const { result, errorResponse } = await requireAdmin(req);
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const { key: rawKey, value } = body;

    // Validate key
    if (!rawKey || !VALID_KILL_SWITCHES.includes(rawKey as KillSwitchKey)) {
      return NextResponse.json(
        { error: "Invalid kill switch key" },
        { status: 400 }
      );
    }

    const key = rawKey as KillSwitchKey;

    // Validate value is boolean
    if (typeof value !== "boolean") {
      return NextResponse.json(
        { error: "Value must be a boolean" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get previous value for audit
    const { data: currentConfig } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", key)
      .single();

    const previousValue = currentConfig?.value;

    // Update the kill switch
    const { error: updateError } = await supabase
      .from("system_config")
      .update({
        value: value,
        updated_by: result.user!.id,
        updated_at: new Date().toISOString(),
      })
      .eq("key", key);

    if (updateError) {
      throw updateError;
    }

    // Clear cache to ensure immediate effect
    clearKillSwitchCache();

    // Audit log
    await logAuditEvent("admin", "admin_action", {
      userId: result.user!.id,
      userEmail: result.adminEmail,
      resourceType: "kill_switch",
      resourceId: key,
      details: {
        action: "toggle",
        previousValue,
        newValue: value,
      },
      request: { headers: req.headers },
    });

    // Determine severity for notification
    const isCritical =
      key === "master_kill_switch" ||
      (key === "ai_features_enabled" && !value) ||
      (key === "payments_enabled" && !value);

    // Notify all admins (non-blocking)
    notifyAllAdmins({
      type: "kill_switch_toggled",
      subject: `${SWITCH_NAMES[key]} ${value ? "Enabled" : "Disabled"}`,
      title: `Kill Switch Toggled: ${SWITCH_NAMES[key]}`,
      message: `The ${SWITCH_NAMES[key]} has been ${value ? "enabled" : "disabled"} by an administrator.`,
      details: {
        Switch: SWITCH_NAMES[key],
        "New Value": value ? "Enabled" : "Disabled",
        "Previous Value":
          previousValue === true || previousValue === "true"
            ? "Enabled"
            : "Disabled",
        "Changed By": result.adminEmail || "Unknown",
      },
      timestamp: new Date().toISOString(),
      severity: isCritical ? "critical" : "warning",
    }).catch((err) => {
      console.error("[Admin API] Failed to send notifications:", err);
    });

    return NextResponse.json({
      success: true,
      key,
      value,
      message: `${SWITCH_NAMES[key]} ${value ? "enabled" : "disabled"}`,
    });
  } catch (error: any) {
    console.error("[Admin API] Error updating kill switch:", error);
    return NextResponse.json(
      { error: "Failed to update kill switch" },
      { status: 500 }
    );
  }
});
