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

// NOTE: sendReply.ts exports are NOT included here because they use
// server-only Node.js modules (googleapis). Import directly from
// './sendReply' in server-side code (API routes) only.

// UI Component
export { ReplyConfigPanel } from './ReplyConfigPanel';
