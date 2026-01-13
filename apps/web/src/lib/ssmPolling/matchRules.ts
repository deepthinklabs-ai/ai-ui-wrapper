/**
 * SSM Rules Matching
 *
 * Wrapper around the SSM rules engine for polling operations.
 * Generates alerts from matched events.
 *
 * Security:
 * - No plaintext logging of event content
 * - Only log counts and rule names
 */

import { matchEvent } from '@/app/canvas/features/ssm-agent/lib/ssmRulesEngine';
import type { SSMEvent, SSMAlert, SSMRulesConfig } from '@/app/canvas/types/ssm';
import type { SSMAutoReplyConfig } from '@/app/canvas/features/ssm-agent/features/auto-reply/types';
import type { MatchResult } from './types';

/**
 * Match events against rules and generate alerts
 *
 * @param events - Events to match
 * @param rules - Rules configuration
 * @param nodeId - Source node ID for alerts
 * @param autoReply - Auto-reply config (for calendar notifications)
 * @param processedIds - Set of already processed event IDs
 * @returns Match results with alerts
 */
export function matchEventsToRules(
  events: SSMEvent[],
  rules: SSMRulesConfig,
  nodeId: string,
  autoReply?: SSMAutoReplyConfig,
  processedIds: Set<string> = new Set()
): MatchResult {
  const alerts: SSMAlert[] = [];
  const newlyProcessedIds: string[] = [];
  let matchedCount = 0;

  // Filter out already-processed events
  const newEvents = events.filter(e => !processedIds.has(e.id));

  for (const event of newEvents) {
    newlyProcessedIds.push(event.id);

    // Match event against rules
    const result = matchEvent(event, rules);

    // Special case: Calendar notifications
    // If notificationRecipient is set and this is a calendar event,
    // treat it as a match even if no rules matched
    const isCalendarNotification =
      event.source === 'calendar' && autoReply?.notificationRecipient;

    if (result.matched || isCalendarNotification) {
      matchedCount++;

      // Use severity from match result (already calculated by matchEvent)
      // Default to 'info' for calendar notifications without rule matches
      const highestSeverity: 'info' | 'warning' | 'critical' = result.severity || 'info';

      // Generate appropriate title based on event source
      let alertTitle: string;
      if (event.source === 'calendar') {
        alertTitle = `Calendar Event: ${event.metadata?.summary || 'No title'}`;
      } else {
        alertTitle = `Email from ${event.metadata?.from || 'Unknown'}: ${event.metadata?.subject || 'No subject'}`;
      }

      // Create alert
      const alert: SSMAlert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        severity: highestSeverity,
        title: alertTitle,
        message: event.content.substring(0, 500),
        event_id: event.id,
        matched_rules: result.matched_rules.length > 0
          ? result.matched_rules.map(r => r.rule_name)
          : ['Calendar Event Notification'],
        timestamp: new Date().toISOString(),
        acknowledged: false,
        source_node_id: nodeId,
        forwarded_to_ai: false, // Will be updated if forwarded
      };

      alerts.push(alert);
    }
  }

  // Log counts only (no content)
  if (alerts.length > 0) {
    console.log(`[SSM Polling] Generated ${alerts.length} alerts from ${newEvents.length} events`);
  }

  return {
    alerts,
    matched_count: matchedCount,
    processed_event_ids: newlyProcessedIds,
  };
}
