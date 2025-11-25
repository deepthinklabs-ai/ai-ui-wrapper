/**
 * Gmail OAuth Feature
 *
 * Public API for Gmail OAuth integration in Genesis Bot nodes.
 * Import from this file rather than internal modules.
 */

// Types
export * from './types';

// Hooks
export { useGmailOAuth } from './hooks/useGmailOAuth';
export { useGmailTools } from './hooks/useGmailTools';

// Components
export { GmailOAuthPanel } from './components/GmailOAuthPanel';

// Utilities
export { gmailTools, getEnabledGmailTools, toClaudeToolFormat } from './lib/gmailTools';
export { formatEmailForDisplay, validateEmailAddress } from './lib/utils';
export {
  executeGmailToolCall,
  executeGmailToolCalls,
  isGmailTool,
  filterGmailToolCalls,
  generateGmailSystemPrompt,
} from './lib/gmailToolExecutor';

// NOTE: Server-side executor (gmailToolExecutorServer.ts) should be imported
// directly in API routes, NOT from this index.ts, to avoid pulling googleapis
// into client-side bundles.
