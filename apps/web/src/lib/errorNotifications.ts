/**
 * Error Notification Utility
 *
 * Sends admin notifications for critical errors.
 * Can be called from error boundaries or API error handlers.
 *
 * Usage:
 *   import { notifyCriticalError } from '@/lib/errorNotifications';
 *
 *   await notifyCriticalError('DatabaseError', 'Connection failed', {
 *     'Database': 'Supabase',
 *     'Region': 'us-east-1',
 *   });
 */

import { notifyAllAdmins } from "./email";

// Track recent error notifications to prevent spam
const recentNotifications = new Map<string, number>();
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes between duplicate notifications

/**
 * Notify admins about a critical error
 *
 * @param errorType - Type/category of error (e.g., "DatabaseError", "StripeError")
 * @param message - Human-readable error message
 * @param details - Optional key-value pairs with additional context
 */
export async function notifyCriticalError(
  errorType: string,
  message: string,
  details?: Record<string, string>
): Promise<void> {
  // Check cooldown to prevent spam
  const key = `${errorType}:${message.substring(0, 100)}`;
  const lastNotified = recentNotifications.get(key);

  if (lastNotified && Date.now() - lastNotified < COOLDOWN_MS) {
    console.log(
      "[ErrorNotification] Skipping duplicate notification (cooldown active)"
    );
    return;
  }

  recentNotifications.set(key, Date.now());

  // Clean up old entries (prevent memory leak)
  if (recentNotifications.size > 100) {
    const now = Date.now();
    for (const [k, v] of recentNotifications.entries()) {
      if (now - v > COOLDOWN_MS) {
        recentNotifications.delete(k);
      }
    }
  }

  try {
    await notifyAllAdmins({
      type: "critical_error",
      subject: `Critical Error: ${errorType}`,
      title: "Critical System Error",
      message,
      details: {
        "Error Type": errorType,
        ...details,
      },
      timestamp: new Date().toISOString(),
      severity: "critical",
    });
  } catch (err) {
    console.error("[ErrorNotification] Failed to send notification:", err);
  }
}

/**
 * Notify admins about rate limit threshold being exceeded
 *
 * @param userId - User ID that triggered the threshold
 * @param userEmail - User's email (if available)
 * @param model - Model being rate limited
 * @param blockCount - Number of blocks in the time window
 */
export async function notifyRateLimitThreshold(
  userId: string,
  userEmail: string | null,
  model: string,
  blockCount: number
): Promise<void> {
  // Check cooldown per user
  const key = `ratelimit:${userId}`;
  const lastNotified = recentNotifications.get(key);

  if (lastNotified && Date.now() - lastNotified < COOLDOWN_MS) {
    console.log(
      "[ErrorNotification] Skipping rate limit notification (cooldown active)"
    );
    return;
  }

  recentNotifications.set(key, Date.now());

  try {
    await notifyAllAdmins({
      type: "rate_limit_threshold",
      subject: `Frequent Rate Limit Blocks: ${userEmail || userId}`,
      title: "Rate Limit Alert",
      message: `A user has been rate limited ${blockCount} times in the past 5 minutes. This may indicate abuse, a bot, or a configuration issue.`,
      details: {
        User: userEmail || userId,
        "User ID": userId,
        Model: model,
        "Blocks (5 min)": blockCount.toString(),
      },
      timestamp: new Date().toISOString(),
      severity: "warning",
    });
  } catch (err) {
    console.error(
      "[ErrorNotification] Failed to send rate limit notification:",
      err
    );
  }
}

/**
 * Check if an error should trigger admin notification based on patterns
 *
 * @param errorType - Type of error
 * @param errorMessage - Error message
 * @returns true if this is a critical error that should be reported
 */
export function isCriticalError(
  errorType: string,
  errorMessage: string
): boolean {
  const criticalPatterns = [
    /database.*error/i,
    /supabase.*error/i,
    /stripe.*error/i,
    /api.*key.*invalid/i,
    /authentication.*failed/i,
    /internal.*server.*error/i,
    /secret.*manager.*error/i,
    /encryption.*error/i,
    /service.*unavailable/i,
  ];

  const combined = `${errorType} ${errorMessage}`;
  return criticalPatterns.some((pattern) => pattern.test(combined));
}

/**
 * Handle an error and potentially notify admins
 * Convenience function that checks if the error is critical before notifying
 *
 * @param errorType - Type of error
 * @param errorMessage - Error message
 * @param details - Optional additional details
 */
export async function handleErrorAndNotify(
  errorType: string,
  errorMessage: string,
  details?: Record<string, string>
): Promise<void> {
  if (isCriticalError(errorType, errorMessage)) {
    await notifyCriticalError(errorType, errorMessage, details);
  }
}
