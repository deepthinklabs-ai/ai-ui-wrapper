/**
 * Gmail OAuth Utilities
 *
 * Helper functions for Gmail OAuth feature.
 */

import type { EmailMessage } from '../types';

/**
 * Validate an email address format
 */
export function validateEmailAddress(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate multiple email addresses
 */
export function validateEmailAddresses(emails: string[]): { valid: boolean; invalid: string[] } {
  const invalid = emails.filter((email) => !validateEmailAddress(email));
  return {
    valid: invalid.length === 0,
    invalid,
  };
}

/**
 * Check if recipient is in allowed domains
 */
export function isRecipientAllowed(
  email: string,
  allowedDomains?: string[]
): boolean {
  if (!allowedDomains || allowedDomains.length === 0) {
    return true; // No restrictions
  }

  const domain = email.split('@')[1]?.toLowerCase();
  return allowedDomains.some((allowed) => allowed.toLowerCase() === domain);
}

/**
 * Format email for display in chat
 */
export function formatEmailForDisplay(email: EmailMessage): string {
  const date = new Date(email.date).toLocaleString();
  const readStatus = email.isRead ? '' : ' [UNREAD]';
  const attachmentStatus = email.hasAttachments ? ' [HAS ATTACHMENTS]' : '';

  return `
---
**From:** ${email.from}
**To:** ${email.to.join(', ')}
**Subject:** ${email.subject}${readStatus}${attachmentStatus}
**Date:** ${date}

${email.body}
---
`.trim();
}

/**
 * Format email snippet for search results
 */
export function formatEmailSnippet(email: EmailMessage): string {
  const date = new Date(email.date).toLocaleDateString();
  const readStatus = email.isRead ? '' : '*';

  return `${readStatus}[${date}] ${email.from}: ${email.subject} - "${email.snippet}"`;
}

/**
 * Format multiple emails as a list
 */
export function formatEmailList(emails: EmailMessage[]): string {
  if (emails.length === 0) {
    return 'No emails found.';
  }

  const header = `Found ${emails.length} email(s):\n\n`;
  const list = emails
    .map((email, index) => {
      const date = new Date(email.date).toLocaleDateString();
      const unread = email.isRead ? '' : ' [UNREAD]';
      return `${index + 1}. **${email.subject}**${unread}\n   From: ${email.from} | Date: ${date}\n   ID: ${email.id}`;
    })
    .join('\n\n');

  return header + list;
}

/**
 * Sanitize email body for safe display
 * NOTE: For production use, consider using DOMPurify or similar library
 */
export function sanitizeEmailBody(body: string): string {
  // SECURITY: Use iterative replacement to handle nested/malformed tags
  let result = body;
  let previousResult = '';

  // Iterate until no more changes (handles nested cases)
  while (result !== previousResult) {
    previousResult = result;
    // Remove script tags (including malformed variants)
    result = result.replace(/<script[^>]*>[\s\S]*?<\/script[^>]*>/gi, '');
    result = result.replace(/<script[^>]*\/?>/gi, '');
    // Remove style tags
    result = result.replace(/<style[^>]*>[\s\S]*?<\/style[^>]*>/gi, '');
    result = result.replace(/<style[^>]*\/?>/gi, '');
  }

  // Remove event handlers
  result = result.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
  result = result.replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '');

  return result;
}

/**
 * Extract plain text from HTML email body
 */
export function htmlToPlainText(html: string): string {
  // SECURITY: Decode &amp; LAST to prevent double-decoding attacks
  // (e.g., &amp;lt; -> &lt; -> < if done in wrong order)
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')  // Decode &amp; LAST
    .trim();
}

/**
 * Generate a unique confirmation ID for email sending
 */
export function generateConfirmationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `email_confirm_${timestamp}_${random}`;
}

/**
 * Check if a confirmation has expired (15 minute window)
 */
export function isConfirmationExpired(createdAt: string): boolean {
  const created = new Date(createdAt);
  const now = new Date();
  const fifteenMinutes = 15 * 60 * 1000;
  return now.getTime() - created.getTime() > fifteenMinutes;
}
