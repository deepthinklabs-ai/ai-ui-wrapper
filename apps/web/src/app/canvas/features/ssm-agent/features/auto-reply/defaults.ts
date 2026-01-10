/**
 * SSM Auto-Reply Defaults
 *
 * Default configurations and utility functions for auto-reply feature.
 */

import RE2 from 're2';
import type {
  SSMAutoReplyConfig,
  SSMReplyTemplate,
  SSMReplyConditions,
  SSMReplyRateLimit,
} from './types';

/**
 * Default reply template
 */
export const DEFAULT_REPLY_TEMPLATE: SSMReplyTemplate = {
  subject: 'Re: {subject}',
  body: `Thank you for your email. This is an automated response.

Your message has been received and flagged for review based on our monitoring rules.

If this requires immediate attention, please contact us directly.

Best regards`,
  includeOriginal: false,
  signature: '',
};

/**
 * Default reply conditions
 */
export const DEFAULT_REPLY_CONDITIONS: SSMReplyConditions = {
  severities: ['warning', 'critical'],
  excludeSenders: [],
  businessHoursOnly: false,
};

/**
 * Default rate limit settings
 */
export const DEFAULT_REPLY_RATE_LIMIT: SSMReplyRateLimit = {
  maxRepliesPerSender: 1,
  windowMinutes: 60,
  sentReplies: {},
};

/**
 * Default auto-reply configuration
 */
export const DEFAULT_AUTO_REPLY_CONFIG: SSMAutoReplyConfig = {
  enabled: false,
  template: DEFAULT_REPLY_TEMPLATE,
  conditions: DEFAULT_REPLY_CONDITIONS,
  rateLimit: DEFAULT_REPLY_RATE_LIMIT,
};

/**
 * Example reply templates for common use cases
 */
export const REPLY_TEMPLATE_EXAMPLES: {
  name: string;
  description: string;
  template: SSMReplyTemplate;
}[] = [
  {
    name: 'Acknowledgment',
    description: 'Simple acknowledgment that the email was received',
    template: {
      subject: 'Re: {subject}',
      body: `Thank you for your email. We have received your message and will review it shortly.

This is an automated response - please do not reply to this email.`,
      includeOriginal: false,
    },
  },
  {
    name: 'Security Alert',
    description: 'Response for potential security-related emails',
    template: {
      subject: 'Re: {subject} - Security Notice',
      body: `This email has been flagged by our security monitoring system.

Matched rules: {matched_rules}
Severity: {severity}

If you are the legitimate sender, please verify your identity through our official channels.

This is an automated security response.`,
      includeOriginal: false,
    },
  },
  {
    name: 'Out of Office',
    description: 'Standard out of office style reply',
    template: {
      subject: 'Re: {subject}',
      body: `Thank you for contacting us.

Your email regarding "{subject}" has been received. We will respond during normal business hours.

For urgent matters, please contact our main line.`,
      includeOriginal: false,
    },
  },
];

/**
 * Replace placeholders in a template string
 */
export function replacePlaceholders(
  template: string,
  values: Record<string, string>
): string {
  let result = template;
  for (const [key, value] of Object.entries(values)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Check if a sender should receive an auto-reply based on conditions
 */
export function shouldSendReply(
  sender: string,
  severity: 'info' | 'warning' | 'critical',
  conditions: SSMReplyConditions
): { shouldSend: boolean; reason?: string } {
  // Check severity
  if (!conditions.severities.includes(severity)) {
    return { shouldSend: false, reason: `Severity '${severity}' not in allowed list` };
  }

  // Check excluded senders
  const senderLower = sender.toLowerCase();
  for (const excluded of conditions.excludeSenders) {
    if (senderLower.includes(excluded.toLowerCase())) {
      return { shouldSend: false, reason: `Sender matches excluded pattern: ${excluded}` };
    }
  }

  // Check sender pattern if specified
  if (conditions.senderPattern) {
    try {
      // Validate pattern length
      const pattern = conditions.senderPattern;
      if (pattern.length > 200) {
        return { shouldSend: false, reason: 'Sender pattern too long' };
      }
      // Use RE2 for safe regex matching (immune to ReDoS)
      const regex = new RE2(pattern, 'i');
      if (!regex.test(sender)) {
        return { shouldSend: false, reason: 'Sender does not match required pattern' };
      }
    } catch {
      // Invalid regex, skip this check
    }
  }

  return { shouldSend: true };
}

/**
 * Check rate limit for a sender
 */
export function checkRateLimit(
  sender: string,
  rateLimit: SSMReplyRateLimit
): { allowed: boolean; reason?: string } {
  const now = Date.now();
  const windowMs = rateLimit.windowMinutes * 60 * 1000;
  const senderReplies = rateLimit.sentReplies?.[sender] || [];

  // Filter to replies within the window
  const recentReplies = senderReplies.filter(
    timestamp => now - new Date(timestamp).getTime() < windowMs
  );

  if (recentReplies.length >= rateLimit.maxRepliesPerSender) {
    return {
      allowed: false,
      reason: `Rate limit exceeded: ${recentReplies.length}/${rateLimit.maxRepliesPerSender} replies in ${rateLimit.windowMinutes} minutes`,
    };
  }

  return { allowed: true };
}

/**
 * Update rate limit tracking after sending a reply
 */
export function recordSentReply(
  sender: string,
  rateLimit: SSMReplyRateLimit
): SSMReplyRateLimit {
  const now = new Date().toISOString();
  const windowMs = rateLimit.windowMinutes * 60 * 1000;
  const currentTime = Date.now();

  // Get existing replies for this sender, filter to recent ones
  const existingReplies = rateLimit.sentReplies?.[sender] || [];
  const recentReplies = existingReplies.filter(
    timestamp => currentTime - new Date(timestamp).getTime() < windowMs
  );

  return {
    ...rateLimit,
    sentReplies: {
      ...rateLimit.sentReplies,
      [sender]: [...recentReplies, now],
    },
  };
}
