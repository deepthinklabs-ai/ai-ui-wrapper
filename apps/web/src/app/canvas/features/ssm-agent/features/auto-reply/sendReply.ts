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

  // Extract sender email from event metadata (cast from unknown)
  const senderFull = String(event.metadata?.from || '');
  const senderEmail = extractEmail(senderFull);
  const senderName = extractName(senderFull);

  if (!senderEmail) {
    return { success: false, error: 'Could not extract sender email' };
  }

  // Check if we should send based on conditions
  const conditionCheck = shouldSendReply(
    senderEmail,
    alert.severity,
    mergedConditions
  );
  if (!conditionCheck.shouldSend) {
    return { success: false, error: conditionCheck.reason };
  }

  // Check rate limit
  const rateLimitCheck = checkRateLimit(senderEmail, mergedRateLimit);
  if (!rateLimitCheck.allowed) {
    return { success: false, error: rateLimitCheck.reason, rateLimited: true };
  }

  // Build placeholder values (cast metadata fields from unknown)
  const subjectValue = String(event.metadata?.subject || 'No subject');
  const dateValue = String(event.metadata?.date || event.timestamp);
  const messageIdValue = String(event.metadata?.messageId || '');
  const threadIdValue = String(event.metadata?.threadId || '');

  const placeholderValues: Record<string, string> = {
    sender: senderEmail,
    sender_name: senderName || senderEmail,
    subject: subjectValue,
    matched_rules: alert.matched_rules.join(', '),
    severity: alert.severity,
    timestamp: event.timestamp,
    content_preview: event.content.substring(0, 100),
  };

  // Replace placeholders in template
  const subject = replacePlaceholders(mergedTemplate.subject, placeholderValues);
  let body = replacePlaceholders(mergedTemplate.body, placeholderValues);

  // Add signature if configured
  if (mergedTemplate.signature) {
    body += `\n\n${mergedTemplate.signature}`;
  }

  // Add original message if configured
  if (mergedTemplate.includeOriginal) {
    body += `\n\n--- Original Message ---\nFrom: ${senderFull}\nSubject: ${subjectValue}\nDate: ${dateValue}\n\n${event.content}`;
  }

  try {
    // Get Gmail client
    const gmail = await getGmailClient(userId);

    // Build email headers
    let headers = `To: ${senderEmail}\r\n`;
    headers += `Subject: ${subject}\r\n`;

    // Add reply headers for proper threading
    if (messageIdValue) {
      headers += `In-Reply-To: <${messageIdValue}>\r\n`;
      headers += `References: <${messageIdValue}>\r\n`;
    }

    headers += `Content-Type: text/plain; charset=utf-8\r\n`;

    // Build raw email
    const emailContent = `${headers}\r\n${body}`;
    const encodedMessage = Buffer.from(emailContent)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    // Prepare request body
    const requestBody: { raw: string; threadId?: string } = {
      raw: encodedMessage,
    };

    // Add threadId for proper Gmail threading
    if (threadIdValue) {
      requestBody.threadId = threadIdValue;
    }

    // Send email
    const response = await gmail.users.messages.send({
      userId: 'me',
      requestBody,
    });

    console.log(`[SSM Auto-Reply] Sent reply to ${senderEmail}, messageId: ${response.data.id}`);

    return {
      success: true,
      messageId: response.data.id ?? undefined,
      threadId: response.data.threadId ?? undefined,
      recipient: senderEmail,
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
