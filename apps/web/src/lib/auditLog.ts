/**
 * Audit Logging Utility
 *
 * Provides structured security event logging for:
 * - Authentication events (login, logout, 2FA, password reset)
 * - API key operations (create, delete, access)
 * - Session events (timeout, revocation)
 * - Security events (CSRF failure, rate limit, suspicious activity)
 *
 * Logs are output in structured JSON format for log aggregation services.
 * Optionally stores to database for querying and compliance.
 */

import { createClient } from "@supabase/supabase-js";

// Event categories
export type AuditEventCategory =
  | "auth"
  | "api_key"
  | "session"
  | "security"
  | "admin"
  | "payment";

// Specific event types
export type AuditEventType =
  // Auth events
  | "login_success"
  | "login_failed"
  | "logout"
  | "signup"
  | "password_reset_requested"
  | "password_reset_completed"
  | "2fa_code_sent"
  | "2fa_code_verified"
  | "2fa_code_failed"
  | "2fa_enabled"
  | "2fa_disabled"
  // API key events
  | "api_key_created"
  | "api_key_deleted"
  | "api_key_accessed"
  | "api_key_rotated"
  // Session events
  | "session_created"
  | "session_expired_idle"
  | "session_expired_absolute"
  | "session_revoked"
  | "session_revoked_all"
  // Security events
  | "csrf_validation_failed"
  | "rate_limit_exceeded"
  | "unauthorized_access"
  | "suspicious_activity"
  | "invalid_token"
  // Payment events
  | "subscription_created"
  | "subscription_cancelled"
  | "subscription_updated"
  | "payment_failed"
  // Admin events
  | "admin_action";

// Severity levels
export type AuditSeverity = "info" | "warning" | "error" | "critical";

// Audit event structure
export type AuditEvent = {
  timestamp: string;
  category: AuditEventCategory;
  event: AuditEventType;
  severity: AuditSeverity;
  userId?: string;
  userEmail?: string;
  ipAddress?: string;
  userAgent?: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  success: boolean;
  errorMessage?: string;
};

// Request context for extracting IP and user agent
export type RequestContext = {
  headers?: Headers;
  ip?: string;
  userAgent?: string;
};

/**
 * Extract IP address from request headers
 */
function extractIP(headers?: Headers): string | undefined {
  if (!headers) return undefined;

  // Check various headers in order of preference
  const ipHeaders = [
    "x-forwarded-for",
    "x-real-ip",
    "cf-connecting-ip", // Cloudflare
    "x-vercel-forwarded-for", // Vercel
  ];

  for (const header of ipHeaders) {
    const value = headers.get(header);
    if (value) {
      // x-forwarded-for can contain multiple IPs, take the first one
      return value.split(",")[0].trim();
    }
  }

  return undefined;
}

/**
 * Extract user agent from request headers
 */
function extractUserAgent(headers?: Headers): string | undefined {
  return headers?.get("user-agent") || undefined;
}

/**
 * Determine severity based on event type
 */
function getSeverity(event: AuditEventType, success: boolean): AuditSeverity {
  // Critical events
  if (
    event === "suspicious_activity" ||
    event === "session_revoked_all"
  ) {
    return "critical";
  }

  // Error events (failures)
  if (!success) {
    if (
      event === "login_failed" ||
      event === "2fa_code_failed" ||
      event === "csrf_validation_failed" ||
      event === "unauthorized_access" ||
      event === "invalid_token"
    ) {
      return "error";
    }
  }

  // Warning events
  if (
    event === "rate_limit_exceeded" ||
    event === "session_expired_idle" ||
    event === "session_expired_absolute" ||
    event === "payment_failed"
  ) {
    return "warning";
  }

  // Default to info
  return "info";
}

/**
 * Log an audit event
 *
 * @param category - Event category
 * @param event - Specific event type
 * @param options - Event details
 */
export async function logAuditEvent(
  category: AuditEventCategory,
  event: AuditEventType,
  options: {
    userId?: string;
    userEmail?: string;
    request?: RequestContext;
    resourceType?: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    success?: boolean;
    errorMessage?: string;
  } = {}
): Promise<void> {
  const {
    userId,
    userEmail,
    request,
    resourceType,
    resourceId,
    details,
    success = true,
    errorMessage,
  } = options;

  const auditEvent: AuditEvent = {
    timestamp: new Date().toISOString(),
    category,
    event,
    severity: getSeverity(event, success),
    userId,
    userEmail,
    ipAddress: request?.ip || extractIP(request?.headers),
    userAgent: request?.userAgent || extractUserAgent(request?.headers),
    resourceType,
    resourceId,
    details: sanitizeDetails(details),
    success,
    errorMessage,
  };

  // Log to console in structured format
  // SECURITY: Use structured logging to avoid format string vulnerabilities
  // Pass event data as a separate object, not interpolated into the message
  const logData = {
    prefix: `[AUDIT:${category.toUpperCase()}]`,
    event,
    userId: userId || "anonymous",
    success,
    details: auditEvent,
  };

  if (auditEvent.severity === "critical" || auditEvent.severity === "error") {
    console.error("[AUDIT]", JSON.stringify(logData));
  } else if (auditEvent.severity === "warning") {
    console.warn("[AUDIT]", JSON.stringify(logData));
  } else {
    console.log("[AUDIT]", JSON.stringify(logData));
  }

  // Optionally store to database (async, non-blocking)
  storeAuditEvent(auditEvent).catch((err) => {
    console.error("[AUDIT] Failed to store audit event:", err.message);
  });
}

/**
 * Sanitize details to remove sensitive information
 * Recursively handles nested objects and arrays
 */
function sanitizeDetails(
  details?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!details) return undefined;

  // List of keys to redact
  const sensitiveKeys = [
    "password",
    "apiKey",
    "api_key",
    "secret",
    "token",
    "accessToken",
    "refreshToken",
    "access_token",
    "refresh_token",
    "authorization",
    "credential",
  ];

  // Check if a key should be redacted
  const shouldRedact = (key: string): boolean => {
    const lowerKey = key.toLowerCase();
    return sensitiveKeys.some((sk) => lowerKey.includes(sk.toLowerCase()));
  };

  // Recursively sanitize a value
  const sanitizeValue = (value: unknown, seen = new WeakSet()): unknown => {
    if (value === null || value === undefined) return value;

    // Handle primitive types
    if (typeof value !== "object") return value;

    // Prevent circular reference issues
    const objValue = value as object;
    if (seen.has(objValue)) return "[CIRCULAR]";
    seen.add(objValue);

    // Handle arrays
    if (Array.isArray(value)) {
      return value.map((item) => sanitizeValue(item, seen));
    }

    // Handle objects
    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (shouldRedact(key)) {
        sanitizedObj[key] = "[REDACTED]";
      } else {
        sanitizedObj[key] = sanitizeValue(val, seen);
      }
    }
    return sanitizedObj;
  };

  return sanitizeValue(details) as Record<string, unknown>;
}

/**
 * Store audit event to database
 */
async function storeAuditEvent(event: AuditEvent): Promise<void> {
  // Only store if we have the service role key (server-side)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return; // Skip database storage in client-side or when not configured
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Store to audit_logs table (create table if not exists is handled by migration)
  const { error } = await supabase.from("audit_logs").insert({
    timestamp: event.timestamp,
    category: event.category,
    event_type: event.event,
    severity: event.severity,
    user_id: event.userId || null,
    user_email: event.userEmail || null,
    ip_address: event.ipAddress || null,
    user_agent: event.userAgent || null,
    resource_type: event.resourceType || null,
    resource_id: event.resourceId || null,
    details: event.details || null,
    success: event.success,
    error_message: event.errorMessage || null,
  });

  if (error) {
    // Don't throw - audit logging should not break the main flow
    console.error("[AUDIT] Database insert failed:", error.message);
  }
}

// Convenience functions for common events

export const auditAuth = {
  loginSuccess: (userId: string, email: string, request?: RequestContext) =>
    logAuditEvent("auth", "login_success", { userId, userEmail: email, request }),

  loginFailed: (email: string, reason: string, request?: RequestContext) =>
    logAuditEvent("auth", "login_failed", {
      userEmail: email,
      request,
      success: false,
      errorMessage: reason,
    }),

  logout: (userId: string, request?: RequestContext) =>
    logAuditEvent("auth", "logout", { userId, request }),

  signup: (userId: string, email: string, request?: RequestContext) =>
    logAuditEvent("auth", "signup", { userId, userEmail: email, request }),

  twoFactorSent: (userId: string, email: string, request?: RequestContext) =>
    logAuditEvent("auth", "2fa_code_sent", { userId, userEmail: email, request }),

  twoFactorVerified: (userId: string, request?: RequestContext) =>
    logAuditEvent("auth", "2fa_code_verified", { userId, request }),

  twoFactorFailed: (userId: string, request?: RequestContext) =>
    logAuditEvent("auth", "2fa_code_failed", { userId, request, success: false }),
};

export const auditApiKey = {
  created: (userId: string, provider: string, request?: RequestContext) =>
    logAuditEvent("api_key", "api_key_created", {
      userId,
      request,
      resourceType: "api_key",
      resourceId: provider,
    }),

  deleted: (userId: string, provider: string, request?: RequestContext) =>
    logAuditEvent("api_key", "api_key_deleted", {
      userId,
      request,
      resourceType: "api_key",
      resourceId: provider,
    }),

  accessed: (userId: string, provider: string, request?: RequestContext) =>
    logAuditEvent("api_key", "api_key_accessed", {
      userId,
      request,
      resourceType: "api_key",
      resourceId: provider,
    }),

  rotated: (userId: string, provider: string, request?: RequestContext) =>
    logAuditEvent("api_key", "api_key_rotated", {
      userId,
      request,
      resourceType: "api_key",
      resourceId: provider,
      details: { reason: "manual_rotation" },
    }),

  rotationWarning: (
    userId: string,
    providers: string[],
    details: { ageInDays?: Record<string, number | null> }
  ) =>
    logAuditEvent("api_key", "api_key_rotated", {
      userId,
      success: true,
      resourceType: "api_key",
      resourceId: providers.join(","),
      details: {
        reason: "rotation_reminder",
        providers,
        ...details,
      },
    }),
};

export const auditSession = {
  created: (userId: string, sessionId: string, request?: RequestContext) =>
    logAuditEvent("session", "session_created", {
      userId,
      request,
      resourceType: "session",
      resourceId: sessionId,
    }),

  expiredIdle: (userId: string, request?: RequestContext) =>
    logAuditEvent("session", "session_expired_idle", { userId, request }),

  expiredAbsolute: (userId: string, request?: RequestContext) =>
    logAuditEvent("session", "session_expired_absolute", { userId, request }),

  revoked: (userId: string, request?: RequestContext) =>
    logAuditEvent("session", "session_revoked", { userId, request }),

  revokedAll: (userId: string, request?: RequestContext) =>
    logAuditEvent("session", "session_revoked_all", { userId, request }),
};

export const auditSecurity = {
  csrfFailed: (path: string, request?: RequestContext) =>
    logAuditEvent("security", "csrf_validation_failed", {
      request,
      success: false,
      details: { path },
    }),

  rateLimitExceeded: (userId: string | undefined, path: string, request?: RequestContext) =>
    logAuditEvent("security", "rate_limit_exceeded", {
      userId,
      request,
      success: false,
      details: { path },
    }),

  unauthorizedAccess: (path: string, reason: string, request?: RequestContext) =>
    logAuditEvent("security", "unauthorized_access", {
      request,
      success: false,
      errorMessage: reason,
      details: { path },
    }),

  suspiciousActivity: (
    userId: string | undefined,
    activity: string,
    request?: RequestContext
  ) =>
    logAuditEvent("security", "suspicious_activity", {
      userId,
      request,
      success: false,
      details: { activity },
    }),
};

export const auditPayment = {
  subscriptionCreated: (userId: string, plan: string, request?: RequestContext) =>
    logAuditEvent("payment", "subscription_created", {
      userId,
      request,
      resourceType: "subscription",
      details: { plan },
    }),

  subscriptionCancelled: (userId: string, request?: RequestContext) =>
    logAuditEvent("payment", "subscription_cancelled", { userId, request }),

  paymentFailed: (userId: string, reason: string, request?: RequestContext) =>
    logAuditEvent("payment", "payment_failed", {
      userId,
      request,
      success: false,
      errorMessage: reason,
    }),
};
