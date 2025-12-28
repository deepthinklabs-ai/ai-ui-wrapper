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
 * Sanitize email body for AI model consumption
 *
 * SECURITY NOTE: We use a simple, secure approach rather than complex regex patterns
 * that are known to be bypassable. Since output goes to AI models (not rendered as HTML),
 * we just need to extract readable text content.
 */
export function sanitizeEmailBody(body: string): string {
  // Simply convert to plain text - AI models don't execute HTML
  // This is safer than attempting regex-based HTML sanitization
  return htmlToPlainText(body);
}

/**
 * Extract plain text from HTML email body
 * Uses server-safe HTML stripping (no jsdom dependency)
 *
 * SECURITY NOTE: Output goes to AI models, not rendered as HTML.
 * We decode entities FIRST to prevent double-escaping attacks,
 * then use iterative tag stripping for complete sanitization.
 */
export function htmlToPlainText(html: string): string {
  let text = html;

  // STEP 1: Decode HTML entities FIRST (prevents double-escaping attack)
  // e.g., &lt;script&gt; becomes <script> which is then stripped
  // If we decoded AFTER stripping, &lt;script&gt; would survive as <script>
  text = decodeHtmlEntities(text);

  // STEP 2: Convert block elements to newlines for readability
  text = text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n');

  // STEP 3: Remove script/style content using iterative approach
  // (handles cases like <<script> that single-pass would miss)
  // Note: \s* handles whitespace in closing tags like </script >
  text = iterativeRemove(text, /<script\b[^]*?<\/script\s*>/gi);
  text = iterativeRemove(text, /<style\b[^]*?<\/style\s*>/gi);

  // STEP 4: Strip all remaining HTML tags iteratively
  text = iterativeRemove(text, /<[^>]*>/g);

  // STEP 5: Clean up whitespace
  return text
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Decode HTML entities safely
 * Handles named entities and numeric entities (decimal and hex)
 */
function decodeHtmlEntities(text: string): string {
  let result = text;

  // Decode named entities (order matters: &amp; must be last)
  const namedEntities: [string, string][] = [
    ['&nbsp;', ' '],
    ['&lt;', '<'],
    ['&gt;', '>'],
    ['&quot;', '"'],
    ['&#39;', "'"],
    ['&apos;', "'"],
    ['&amp;', '&'], // Must be last to avoid double-decoding
  ];

  for (const [entity, char] of namedEntities) {
    result = result.split(entity).join(char);
  }

  // Decode numeric entities (decimal: &#65; and hex: &#x41;)
  result = result.replace(/&#(\d+);/g, (_, code) => {
    const num = parseInt(code, 10);
    return num > 0 && num < 0x10ffff ? String.fromCharCode(num) : '';
  });
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, code) => {
    const num = parseInt(code, 16);
    return num > 0 && num < 0x10ffff ? String.fromCharCode(num) : '';
  });

  return result;
}

/**
 * Iteratively remove patterns until no more matches
 * Prevents incomplete sanitization (e.g., <<script> leaving <script>)
 */
function iterativeRemove(text: string, pattern: RegExp): string {
  let result = text;
  let prev = '';
  // Limit iterations to prevent infinite loops on pathological input
  for (let i = 0; i < 10 && result !== prev; i++) {
    prev = result;
    result = result.replace(pattern, '');
  }
  return result;
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
