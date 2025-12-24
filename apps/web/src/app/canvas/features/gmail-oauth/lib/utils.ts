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
 * Uses server-safe HTML sanitization (no jsdom dependency)
 */
export function sanitizeEmailBody(body: string): string {
  // SECURITY: Remove dangerous tags and attributes
  // This approach works on both server and client without jsdom
  return body
    // Remove script tags and their content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove style tags and their content
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove iframe, object, embed, form tags
    .replace(/<(iframe|object|embed|form)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(iframe|object|embed|form)\b[^>]*\/?>/gi, '')
    // Remove event handler attributes (on*)
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '')
    // Remove javascript: and vbscript: URLs
    .replace(/\s+href\s*=\s*["']?\s*javascript:[^"'>\s]*/gi, '')
    .replace(/\s+src\s*=\s*["']?\s*javascript:[^"'>\s]*/gi, '')
    // Remove data: URLs in src attributes (potential XSS vector)
    .replace(/\s+src\s*=\s*["']?\s*data:[^"'>\s]*/gi, '');
}

/**
 * Extract plain text from HTML email body
 * Uses server-safe HTML stripping (no jsdom dependency)
 */
export function htmlToPlainText(html: string): string {
  // First, convert block elements to newlines for readability
  const withNewlines = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n');

  // Strip all HTML tags (server-safe approach)
  const plainText = withNewlines
    // Remove script tags and their content first
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove style tags and their content
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove all HTML tags
    .replace(/<[^>]*>/g, '')
    // Decode common HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));

  // Clean up whitespace
  return plainText
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines
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
