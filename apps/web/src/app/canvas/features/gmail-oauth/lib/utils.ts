/**
 * Gmail OAuth Utilities
 *
 * Helper functions for Gmail OAuth feature.
 */

import DOMPurify from 'isomorphic-dompurify';
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
 * Uses DOMPurify for robust XSS protection
 */
export function sanitizeEmailBody(body: string): string {
  // SECURITY: Use DOMPurify for proper HTML sanitization
  // This removes all scripts, event handlers, and dangerous content
  return DOMPurify.sanitize(body, {
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    ALLOW_DATA_ATTR: false,
  });
}

/**
 * Extract plain text from HTML email body
 * Uses DOMPurify for safe HTML stripping
 */
export function htmlToPlainText(html: string): string {
  // SECURITY: Use DOMPurify to safely strip all HTML tags
  // First, convert block elements to newlines for readability
  const withNewlines = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n');

  // Strip all HTML using DOMPurify (returns plain text only)
  const plainText = DOMPurify.sanitize(withNewlines, {
    ALLOWED_TAGS: [], // No tags allowed - pure text output
    ALLOWED_ATTR: [],
    KEEP_CONTENT: true, // Keep the text content
  });

  // Clean up whitespace
  return plainText
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/**
 * Generate a unique confirmation ID for email sending
 * Uses cryptographically secure randomness
 */
export function generateConfirmationId(): string {
  const timestamp = Date.now().toString(36);
  // SECURITY: Use crypto.randomUUID() instead of Math.random()
  const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID().split('-')[0]
    : Date.now().toString(36);
  return `email_confirm_${timestamp}_${randomPart}`;
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
