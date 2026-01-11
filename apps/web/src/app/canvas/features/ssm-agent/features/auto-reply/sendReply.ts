/**
 * SSM Auto-Reply Send Service
 *
 * Server-side service for sending automatic email replies.
 * Uses Gmail API to send replies to emails that match SSM rules.
 */

import { getGmailClient } from '@/lib/googleClients';
import type { SSMAutoReplyConfig, SSMAutoReplyResult } from './types';
import type { SSMEvent, SSMAlert } from '../../../../types/ssm';
import {
  replacePlaceholders,
  shouldSendReply,
  checkRateLimit,
  recordSentReply,
  DEFAULT_REPLY_CONDITIONS,
  DEFAULT_REPLY_RATE_LIMIT,
  DEFAULT_REPLY_TEMPLATE,
} from './defaults';

/**
 * Send an auto-reply for a matched SSM event
 * Supports both:
 * - Email replies (replies to the original sender)
 * - Calendar notifications (sends to a configured recipient)
 */
export async function sendAutoReply(
  userId: string,
  event: SSMEvent,
  alert: SSMAlert,
  config: SSMAutoReplyConfig
): Promise<SSMAutoReplyResult> {
  // Check if auto-reply is enabled
  if (!config.enabled) {
    return { success: false, error: 'Auto-reply is disabled' };
  }

  // Merge config with defaults to ensure all required fields exist
  // Always allow all severities - this is a simple feature that shouldn't be blocked
  // by AI-generated severity restrictions. Users want auto-reply to work.
  const mergedConditions = {
    ...DEFAULT_REPLY_CONDITIONS,
    ...config.conditions,
    // Always include all severities - severity filtering is too restrictive for auto-reply
    severities: ['info', 'warning', 'critical'] as ('info' | 'warning' | 'critical')[],
  };
  const mergedRateLimit = {
    ...DEFAULT_REPLY_RATE_LIMIT,
    ...config.rateLimit,
  };
  const mergedTemplate = {
    ...DEFAULT_REPLY_TEMPLATE,
    ...config.template,
  };

  // Determine recipient based on event source
  let recipientEmail: string;
  let senderName: string = '';
  let isCalendarNotification = false;

  if (event.source === 'calendar') {
    // For calendar events, use the configured notification recipient
    if (!config.notificationRecipient) {
      return { success: false, error: 'No notification recipient configured for calendar events' };
    }
    recipientEmail = config.notificationRecipient;
    isCalendarNotification = true;
    console.log(`[SSM Auto-Reply] Calendar event - sending notification to ${recipientEmail}`);
  } else {
    // For emails, reply to the sender
    const senderFull = String(event.metadata?.from || '');
    recipientEmail = extractEmail(senderFull);
    senderName = extractName(senderFull);

    if (!recipientEmail) {
      return { success: false, error: 'Could not extract sender email' };
    }
  }

  // Check if we should send based on conditions (skip for calendar notifications)
  if (!isCalendarNotification) {
    const conditionCheck = shouldSendReply(
      recipientEmail,
      alert.severity,
      mergedConditions
    );
    if (!conditionCheck.shouldSend) {
      return { success: false, error: conditionCheck.reason };
    }
  }

  // Check rate limit
  const rateLimitCheck = checkRateLimit(recipientEmail, mergedRateLimit);
  if (!rateLimitCheck.allowed) {
    return { success: false, error: rateLimitCheck.reason, rateLimited: true };
  }

  // Build placeholder values based on event type
  let subject: string;
  let body: string;

  if (isCalendarNotification) {
    // Build calendar notification email
    const eventSummary = String(event.metadata?.summary || 'No title');
    const eventStart = String(event.metadata?.start || 'Not specified');
    const eventEnd = String(event.metadata?.end || 'Not specified');
    const eventLocation = String(event.metadata?.location || 'Not specified');
    const eventDescription = String(event.metadata?.description || 'No description');
    const eventOrganizer = String(event.metadata?.organizer || 'Unknown');

    subject = `📅 New Calendar Event: ${eventSummary}`;
    body = `A new calendar event has been detected:\n\n` +
      `📌 Event: ${eventSummary}\n` +
      `🕐 Start: ${eventStart}\n` +
      `🕑 End: ${eventEnd}\n` +
      `📍 Location: ${eventLocation}\n` +
      `👤 Organizer: ${eventOrganizer}\n\n` +
      `📝 Description:\n${eventDescription}\n\n` +
      `---\nMatched rules: ${alert.matched_rules.join(', ')}\n` +
      `Severity: ${alert.severity}`;

    if (mergedTemplate.signature) {
      body += `\n\n${mergedTemplate.signature}`;
    }
  } else {
    // Build email reply (original logic)
    const subjectValue = String(event.metadata?.subject || 'No subject');
    const dateValue = String(event.metadata?.date || event.timestamp);
    const senderFull = String(event.metadata?.from || '');

    const placeholderValues: Record<string, string> = {
      sender: recipientEmail,
      sender_name: senderName || recipientEmail,
      subject: subjectValue,
      matched_rules: alert.matched_rules.join(', '),
      severity: alert.severity,
      timestamp: event.timestamp,
      content_preview: event.content.substring(0, 100),
    };

    subject = replacePlaceholders(mergedTemplate.subject, placeholderValues);
    body = replacePlaceholders(mergedTemplate.body, placeholderValues);

    if (mergedTemplate.signature) {
      body += `\n\n${mergedTemplate.signature}`;
    }

    if (mergedTemplate.includeOriginal) {
      body += `\n\n--- Original Message ---\nFrom: ${senderFull}\nSubject: ${subjectValue}\nDate: ${dateValue}\n\n${event.content}`;
    }
  }

  // Get threading info (only for email replies)
  const messageIdValue = isCalendarNotification ? '' : String(event.metadata?.messageId || '');
  const threadIdValue = isCalendarNotification ? '' : String(event.metadata?.threadId || '');

  try {
    // Get Gmail client
    const gmail = await getGmailClient(userId);

    // Build email headers
    let headers = `To: ${recipientEmail}\r\n`;
    headers += `Subject: ${subject}\r\n`;

    // Add reply headers for proper threading (only for email replies)
    if (messageIdValue) {
      headers += `In-Reply-To: <${messageIdValue}>\r\n`;
      headers += `References: <${messageIdValue}>\r\n`;
    }

    headers += `Content-Type: text/plain; charset=utf-8\r\n`;

    // Build raw email
    const emailContent = `${headers}\r\n${body}`;
    let encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
    // Remove trailing padding (base64 has at most 2 trailing '=' chars)
    // Using loop instead of regex to avoid potential ReDoS warnings
    while (encodedMessage.endsWith('=')) {
      encodedMessage = encodedMessage.slice(0, -1);
    }

    // Prepare request body
    const requestBody: { raw: string; threadId?: string } = {
      raw: encodedMessage,
    };

    // Add threadId for proper Gmail threading (only for email replies)
    if (threadIdValue) {
      requestBody.threadId = threadIdValue;
    }

    // Send email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody,
    });

    console.log(`[SSM Auto-Reply] Sent ${isCalendarNotification ? 'notification' : 'reply'} to ${recipientEmail}, messageId: ${response.data.id}`);

    return {
      success: true,
      messageId: response.data.id ?? undefined,
      threadId: response.data.threadId ?? undefined,
      recipient: recipientEmail,
    };
  } catch (error) {
    console.error('[SSM Auto-Reply] Failed to send:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send reply',
    };
  }
}

/**
 * Extract email address from "Name <email@example.com>" format
 */
function extractEmail(from: string): string {
  const match = from.match(/<([^>]+)>/);
  if (match) {
    return match[1];
  }
  // If no angle brackets, assume the whole string is an email
  if (from.includes('@')) {
    return from.trim();
  }
  return '';
}

/**
 * Extract name from "Name <email@example.com>" format
 */
function extractName(from: string): string {
  const match = from.match(/^([^<]+)</);
  if (match) {
    return match[1].trim().replace(/"/g, '');
  }
  return '';
}

/**
 * Process auto-reply for an SSM alert
 * Returns updated rate limit config to persist
 */
export async function processAutoReply(
  userId: string,
  event: SSMEvent,
  alert: SSMAlert,
  config: SSMAutoReplyConfig
): Promise<{
  result: SSMAutoReplyResult;
  updatedRateLimit: SSMAutoReplyConfig['rateLimit'];
}> {
  const result = await sendAutoReply(userId, event, alert, config);

  // Update rate limit tracking if reply was sent successfully
  let updatedRateLimit = config.rateLimit;
  if (result.success && result.recipient) {
    updatedRateLimit = recordSentReply(result.recipient, config.rateLimit);
  }

  return { result, updatedRateLimit };
}
