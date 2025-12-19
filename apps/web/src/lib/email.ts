/**
 * Centralized Email Utility
 *
 * Provides reusable email sending functionality using Resend.
 * Includes templates for admin notifications.
 *
 * Usage:
 *   import { notifyAllAdmins } from '@/lib/email';
 *
 *   await notifyAllAdmins({
 *     type: 'kill_switch_toggled',
 *     subject: 'AI Features Disabled',
 *     title: 'Kill Switch Toggled',
 *     message: 'AI features have been disabled by an administrator.',
 *     severity: 'warning',
 *     timestamp: new Date().toISOString(),
 *   });
 */

import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";

// Initialize Resend (lazy to avoid issues if not configured)
let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!resend && process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
  }
  return resend;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "noreply@resend.dev";
const APP_NAME = "AI Chat Platform";

// Email types
export type AdminNotificationType =
  | "kill_switch_toggled"
  | "critical_error"
  | "rate_limit_threshold";

export interface AdminNotificationData {
  type: AdminNotificationType;
  subject: string;
  title: string;
  message: string;
  details?: Record<string, string>;
  timestamp: string;
  severity: "info" | "warning" | "critical";
}

/**
 * Send email to a specific admin user
 */
export async function sendAdminNotification(
  adminEmail: string,
  data: AdminNotificationData
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const client = getResend();
  if (!client) {
    console.warn("[Email] Resend not configured, skipping notification");
    return { success: false, error: "Email service not configured" };
  }

  const severityColors = {
    info: { bg: "#3b82f6", text: "#60a5fa" }, // Blue
    warning: { bg: "#f59e0b", text: "#fbbf24" }, // Amber
    critical: { bg: "#ef4444", text: "#f87171" }, // Red
  };

  const colors = severityColors[data.severity];

  // Build details table HTML
  let detailsHtml = "";
  if (data.details && Object.keys(data.details).length > 0) {
    const rows = Object.entries(data.details)
      .map(
        ([key, value]) => `
        <tr>
          <td style="color: #64748b; padding: 8px 0; font-size: 14px; border-bottom: 1px solid #334155;">${escapeHtml(key)}</td>
          <td style="color: #e2e8f0; padding: 8px 0; font-size: 14px; border-bottom: 1px solid #334155; text-align: right;">${escapeHtml(value)}</td>
        </tr>
      `
      )
      .join("");

    detailsHtml = `
      <div style="background-color: #0f172a; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
        <table style="width: 100%; border-collapse: collapse;">
          ${rows}
        </table>
      </div>
    `;
  }

  try {
    const { data: emailData, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: adminEmail,
      subject: `[${APP_NAME}] ${data.subject}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #0f172a; color: #e2e8f0; padding: 40px 20px; margin: 0;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; padding: 32px; border: 1px solid #334155;">
            <!-- Severity Badge -->
            <div style="background-color: ${colors.bg}20; border: 1px solid ${colors.bg}40; border-radius: 6px; padding: 8px 16px; display: inline-block; margin-bottom: 24px;">
              <span style="color: ${colors.text}; font-weight: 600; text-transform: uppercase; font-size: 12px;">
                ${data.severity.toUpperCase()}
              </span>
            </div>

            <!-- Title -->
            <h1 style="color: #f1f5f9; font-size: 24px; font-weight: 600; margin: 0 0 16px 0;">
              ${escapeHtml(data.title)}
            </h1>

            <!-- Message -->
            <p style="color: #94a3b8; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              ${escapeHtml(data.message)}
            </p>

            <!-- Details Table -->
            ${detailsHtml}

            <!-- Timestamp -->
            <p style="color: #64748b; font-size: 12px; margin: 0;">
              Timestamp: ${escapeHtml(data.timestamp)}
            </p>

            <!-- Footer -->
            <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #334155;">
              <p style="color: #64748b; font-size: 12px; margin: 0;">
                This is an automated notification from ${APP_NAME}.
                <a href="${process.env.NEXT_PUBLIC_APP_URL || ""}/admin" style="color: #60a5fa;">Manage Kill Switches</a>
              </p>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error("[Email] Failed to send admin notification:", error);
      return { success: false, error: error.message };
    }

    console.log(`[Email] Sent notification to ${adminEmail}: ${data.subject}`);
    return { success: true, messageId: emailData?.id };
  } catch (err: any) {
    console.error("[Email] Error sending admin notification:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Get all admin emails from the database
 */
export async function getAdminEmails(): Promise<string[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get admin user IDs
  const { data: admins, error } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("is_admin", true);

  if (error || !admins || admins.length === 0) {
    if (error) {
      console.error("[Email] Failed to fetch admin profiles:", error.message);
    }
    return [];
  }

  // Get emails from auth.users
  const emails: string[] = [];
  for (const admin of admins) {
    const { data: userData } = await supabase.auth.admin.getUserById(admin.id);
    if (userData?.user?.email) {
      emails.push(userData.user.email);
    }
  }

  return emails;
}

/**
 * Notify all admins about an event
 */
export async function notifyAllAdmins(
  data: AdminNotificationData
): Promise<void> {
  const adminEmails = await getAdminEmails();

  if (adminEmails.length === 0) {
    console.warn("[Email] No admin emails found, skipping notification");
    return;
  }

  // Send to all admins (non-blocking)
  const results = await Promise.allSettled(
    adminEmails.map((email) => sendAdminNotification(email, data))
  );

  const successful = results.filter(
    (r) => r.status === "fulfilled" && (r.value as any).success
  ).length;
  console.log(
    `[Email] Sent admin notifications: ${successful}/${adminEmails.length}`
  );
}

/**
 * Escape HTML to prevent XSS in email templates
 */
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (char) => htmlEntities[char]);
}
