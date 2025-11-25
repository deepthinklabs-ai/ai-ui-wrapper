/**
 * Google Docs OAuth Feature
 *
 * Provides Google Docs integration for Genesis Bot nodes.
 */

// Types
export * from './types';

// Components
export { DocsOAuthPanel } from './components/DocsOAuthPanel';

// Hooks
export { useDocsOAuth } from './hooks/useDocsOAuth';
export { useDocsTools } from './hooks/useDocsTools';

// Library functions
export {
  DOCS_TOOLS,
  getEnabledDocsTools,
  toClaudeToolFormat,
  generateDocsSystemPrompt,
} from './lib/docsTools';

export {
  extractDocumentId,
  buildDocsUrl,
  extractPlainText,
  getDocumentEndIndex,
  formatDocumentContent,
} from './lib/utils';

// Client-side executor only
export { executeDocsToolCalls } from './lib/docsToolExecutor';

// NOTE: Server-side executor (docsToolExecutorServer.ts) should be imported
// directly in API routes, NOT from this index.ts, to avoid pulling googleapis
// into client-side bundles.
