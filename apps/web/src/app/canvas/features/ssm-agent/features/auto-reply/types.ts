/**
 * SSM Auto-Reply Feature Types
 *
 * Type definitions for the automatic email reply functionality.
 * When SSM rules match, can automatically send a reply to the sender.
 */

/**
 * Configuration for automatic reply behavior
 */
export interface SSMAutoReplyConfig {
  /** Whether auto-reply is enabled */
  enabled: boolean;

  /** Reply template with placeholder support */
  template: SSMReplyTemplate;

  /** Conditions for when to send replies */
  conditions: SSMReplyConditions;

  /** Rate limiting to prevent spam */
  rateLimit: SSMReplyRateLimit;

  /**
   * For calendar events: send notification to this email instead of replying to sender.
   * This enables "send email to X when calendar event occurs" use cases.
   */
  notificationRecipient?: string;
}

/**
 * Reply template configuration
 */
export interface SSMReplyTemplate {
  /** Subject line template (supports placeholders) */
  subject: string;

  /** Body template (supports placeholders) */
  body: string;

  /** Whether to include original message in reply */
  includeOriginal: boolean;

  /** Signature to append */
  signature?: string;
}

/**
 * Conditions for triggering auto-reply
 */
export interface SSMReplyConditions {
  /** Only reply to specific severity levels */
  severities: ('info' | 'warning' | 'critical')[];

  /** Only reply if sender matches pattern (optional) */
  senderPattern?: string;

  /** Exclude these senders from auto-reply */
  excludeSenders: string[];

  /** Only reply during business hours (optional) */
  businessHoursOnly?: boolean;
}

/**
 * Rate limiting configuration
 */
export interface SSMReplyRateLimit {
  /** Maximum replies per sender per time window */
  maxRepliesPerSender: number;

  /** Time window in minutes */
  windowMinutes: number;

  /** Track sent replies (sender -> timestamps) */
  sentReplies?: Record<string, string[]>;
}

/**
 * Result of sending an auto-reply
 */
export interface SSMAutoReplyResult {
  success: boolean;
  messageId?: string;
  threadId?: string;
  recipient?: string;
  error?: string;
  rateLimited?: boolean;
}

/**
 * Placeholders available in reply templates
 */
export type SSMReplyPlaceholder =
  | '{sender}'           // Original sender email
  | '{sender_name}'      // Original sender name (if available)
  | '{subject}'          // Original subject
  | '{matched_rules}'    // List of rules that matched
  | '{severity}'         // Alert severity
  | '{timestamp}'        // When the email was received
  | '{content_preview}'; // First 100 chars of content

/**
 * All available placeholders for documentation
 */
export const REPLY_PLACEHOLDERS: { placeholder: SSMReplyPlaceholder; description: string }[] = [
  { placeholder: '{sender}', description: 'Original sender email address' },
  { placeholder: '{sender_name}', description: 'Original sender name (if available)' },
  { placeholder: '{subject}', description: 'Original email subject' },
  { placeholder: '{matched_rules}', description: 'Comma-separated list of matched rules' },
  { placeholder: '{severity}', description: 'Alert severity (info, warning, critical)' },
  { placeholder: '{timestamp}', description: 'When the email was received' },
  { placeholder: '{content_preview}', description: 'First 100 characters of email content' },
];
