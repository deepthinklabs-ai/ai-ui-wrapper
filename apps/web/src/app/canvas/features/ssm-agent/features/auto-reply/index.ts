/**
 * SSM Auto-Reply Feature Module
 *
 * Automatic email reply functionality for SSM nodes.
 * When rules match, can automatically send configured replies.
 */

// Types
export type {
  SSMAutoReplyConfig,
  SSMReplyTemplate,
  SSMReplyConditions,
  SSMReplyRateLimit,
  SSMAutoReplyResult,
  SSMReplyPlaceholder,
} from './types';

export { REPLY_PLACEHOLDERS } from './types';

// Defaults and utilities
export {
  DEFAULT_AUTO_REPLY_CONFIG,
  DEFAULT_REPLY_TEMPLATE,
  DEFAULT_REPLY_CONDITIONS,
  DEFAULT_REPLY_RATE_LIMIT,
  REPLY_TEMPLATE_EXAMPLES,
  replacePlaceholders,
  shouldSendReply,
  checkRateLimit,
  recordSentReply,
} from './defaults';

// Service
export { sendAutoReply, processAutoReply } from './sendReply';

// UI Component
export { ReplyConfigPanel } from './ReplyConfigPanel';
