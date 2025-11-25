/**
 * Google Sheets OAuth Feature
 *
 * Public API for Sheets integration in Genesis Bot nodes.
 * Import from this file rather than internal modules.
 */

// Types
export * from './types';

// Hooks
export { useSheetsOAuth } from './hooks/useSheetsOAuth';
export { useSheetsTools } from './hooks/useSheetsTools';

// Components
export { SheetsOAuthPanel } from './components/SheetsOAuthPanel';

// Utilities
export { sheetsTools, getEnabledSheetsTools, toClaudeToolFormat } from './lib/sheetsTools';
export {
  extractSpreadsheetId,
  isValidSpreadsheetId,
  formatAsTable,
  summarizeSpreadsheetData,
} from './lib/utils';
export {
  executeSheetsToolCall,
  executeSheetsToolCalls,
  isSheetsTool,
  filterSheetsToolCalls,
  generateSheetsSystemPrompt,
} from './lib/sheetsToolExecutor';

// NOTE: Server-side executor (sheetsToolExecutorServer.ts) should be imported
// directly in API routes, NOT from this index.ts, to avoid pulling googleapis
// into client-side bundles.
