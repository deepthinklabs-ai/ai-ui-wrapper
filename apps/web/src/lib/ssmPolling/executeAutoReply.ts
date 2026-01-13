/**
 * SSM Auto-Reply Execution
 *
 * Processes auto-replies for matched events.
 * Handles both email replies and calendar notifications.
 *
 * Security:
 * - No plaintext logging of email content or recipients
 * - Only log counts and success/failure status
 */

import { processAutoReply } from '@/app/canvas/features/ssm-agent/features/auto-reply/sendReply';
import type { SSMEvent, SSMAlert } from '@/app/canvas/types/ssm';
import type { SSMAutoReplyConfig } from '@/app/canvas/features/ssm-agent/features/auto-reply/types';
import type { AutoReplyResult } from './types';

/**
 * Process auto-replies for matched events
 *
 * @param userId - User ID for sending emails
 * @param events - Events that matched rules
 * @param alerts - Generated alerts (1:1 with events)
 * @param config - Auto-reply configuration
 * @returns Result with counts and errors
 */
export async function executeAutoReplies(
  userId: string,
  events: SSMEvent[],
  alerts: SSMAlert[],
  config?: SSMAutoReplyConfig
): Promise<AutoReplyResult> {
  const result: AutoReplyResult = {
    sent_count: 0,
    rate_limited_count: 0,
    failed_count: 0,
    errors: [],
  };

  // Skip if auto-reply is not configured or disabled
  if (!config?.enabled) {
    return result;
  }

  // Create a map of event_id to alert for lookup
  const alertsByEventId = new Map<string, SSMAlert>();
  for (const alert of alerts) {
    alertsByEventId.set(alert.event_id, alert);
  }

  // Process auto-reply for each event that has an alert
  for (const event of events) {
    const alert = alertsByEventId.get(event.id);
    if (!alert) continue;

    try {
      const replyResult = await processAutoReply(userId, event, alert, config);

      if (replyResult.result.success) {
        result.sent_count++;
      } else if (replyResult.result.rateLimited) {
        result.rate_limited_count++;
      } else {
        result.failed_count++;
        if (replyResult.result.error) {
          result.errors.push(replyResult.result.error);
        }
      }
    } catch (error) {
      result.failed_count++;
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(errorMsg);
    }
  }

  // Log counts only (no content)
  if (result.sent_count > 0 || result.failed_count > 0) {
    console.log(
      `[SSM Polling] Auto-reply: ${result.sent_count} sent, ` +
      `${result.rate_limited_count} rate limited, ${result.failed_count} failed`
    );
  }

  return result;
}
