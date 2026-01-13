/**
 * SSM Polling Module
 *
 * Shared polling logic for SSM nodes.
 * Used by both Vercel cron job and manual poll operations.
 *
 * Module Structure:
 * - types.ts - Type definitions
 * - fetchEvents.ts - Gmail/Calendar event fetching
 * - matchRules.ts - Rules matching
 * - executeAutoReply.ts - Auto-reply execution
 * - pollNode.ts - Main orchestrator
 * - parallelProcess.ts - Controlled concurrency utility
 */

// Types
export type {
  PollSource,
  PollOptions,
  FetchEventsResult,
  MatchResult,
  AutoReplyResult,
  PollResult,
  PollingConfig,
  NodeRuntimeState,
} from './types';

export { toPollingConfig } from './types';

// Event fetching
export {
  fetchGmailEvents,
  fetchCalendarEvents,
  fetchAllEvents,
} from './fetchEvents';

// Rules matching
export { matchEventsToRules } from './matchRules';

// Auto-reply execution
export { executeAutoReplies } from './executeAutoReply';

// Main orchestrator
export { pollSSMNode } from './pollNode';

// Parallel processing utility
export {
  processInParallel,
  processInParallelDefault,
  type ParallelProcessOptions,
  type ParallelProcessResult,
} from './parallelProcess';
