/**
 * Ask/Answer Feature - Public API
 *
 * Centralized exports for Ask/Answer feature.
 * Clean interface for importing Ask/Answer functionality.
 */

// Hooks
export { useAskAnswer } from './hooks/useAskAnswer';

// Components
export { default as AskAnswerToggle } from './components/AskAnswerToggle';
export { default as QueryInput } from './components/QueryInput';
export { default as QueryReviewPanel } from './components/QueryReviewPanel';

// Types
export type {
  AskAnswerEdgeMetadata,
  AskAnswerNodeConfig,
  AskAnswerQueryRequest,
  AskAnswerQueryResponse,
  AskAnswerStatusUpdate,
  UseAskAnswerResult,
  AskAnswerQueryParams,
  PendingAnswer,
  QueryHistoryEntry,
  AskAnswerToggleProps,
  QueryInputProps,
  QueryReviewPanelProps,
  AnswerIndicatorProps,
  AskAnswerValidationResult,
} from './types';

// Validation utilities (exposed for advanced usage)
export {
  validateAskAnswerEligibility,
  validateQuery,
  isAskAnswerEnabled,
  findEdgeBetweenNodes,
  getAskAnswerEdgesForNode,
  sanitizeQuery,
  generateQueryId,
} from './lib/validation';

// Constants
export { ASK_ANSWER_CONSTANTS } from './types';
