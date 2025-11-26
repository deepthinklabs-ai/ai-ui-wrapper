/**
 * Slack OAuth Feature
 *
 * Provides Slack integration for Genesis Bot nodes.
 */

// Types
export * from './types';

// Components
export { SlackOAuthPanel } from './components/SlackOAuthPanel';

// Hooks
export { useSlackOAuth } from './hooks/useSlackOAuth';
export { useSlackTools } from './hooks/useSlackTools';

// Library functions
export {
  SLACK_TOOLS,
  getEnabledSlackTools,
  toClaudeToolFormat,
  generateSlackSystemPrompt,
} from './lib/slackTools';

// Client-side executor only
export { executeSlackToolCalls } from './lib/slackToolExecutor';

// NOTE: Server-side executor (slackToolExecutorServer.ts) should be imported
// directly in API routes, NOT from this index.ts, to avoid pulling @slack/web-api
// into client-side bundles.
