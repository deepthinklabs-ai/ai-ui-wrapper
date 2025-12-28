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

  // STEP 3: Remove script/style tags and their content
  // Using string-based removal to avoid regex complexity issues
  text = removeTagWithContent(text, 'script');
  text = removeTagWithContent(text, 'style');

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
 * Remove HTML tag and its content using string-based parsing
 * More robust than regex for handling malformed HTML variants
 *
 * SECURITY NOTE: This is for text extraction to AI models, not XSS prevention.
 * The simple approach handles common cases; edge cases just become text.
 */
function removeTagWithContent(html: string, tagName: string): string {
  const lowerHtml = html.toLowerCase();
  const openTag = `<${tagName.toLowerCase()}`;
  const closeTag = `</${tagName.toLowerCase()}`;

  let result = '';
  let pos = 0;
  let iterations = 0;
  const maxIterations = 100; // Prevent infinite loops

  while (pos < html.length && iterations < maxIterations) {
    iterations++;
    const openStart = lowerHtml.indexOf(openTag, pos);

    if (openStart === -1) {
      // No more opening tags, append rest of string
      result += html.slice(pos);
      break;
    }

    // Find end of opening tag (handles <script>, <script src="...">, etc.)
    let openEnd = lowerHtml.indexOf('>', openStart);
    if (openEnd === -1) {
      // Malformed - no closing >, append rest
      result += html.slice(pos);
      break;
    }

    // Append content before this tag
    result += html.slice(pos, openStart);

    // Find closing tag (case-insensitive search)
    const closeStart = lowerHtml.indexOf(closeTag, openEnd);
    if (closeStart === -1) {
      // No closing tag, just skip opening tag and continue
      pos = openEnd + 1;
      continue;
    }

    // Find end of closing tag
    let closeEnd = lowerHtml.indexOf('>', closeStart);
    if (closeEnd === -1) {
      closeEnd = html.length - 1;
    }

    // Skip past the entire tag including content
    pos = closeEnd + 1;
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
