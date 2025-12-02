/**
 * Calendar OAuth Feature
 *
 * Google Calendar integration for Genesis Bot nodes.
 * Allows bots to read, create, update, and delete calendar events.
 */

// Types
export * from './types';

// Tools
export { calendarTools, getEnabledCalendarTools, toClaudeToolFormat, toOpenAIFunctionFormat } from './lib/calendarTools';

// Client-side executor
export { executeCalendarToolCall, executeCalendarToolCalls, checkCalendarConnection, generateCalendarSystemPrompt } from './lib/calendarToolExecutor';

// Server-side executor
export { executeCalendarToolCallServer, executeCalendarToolCallsServer } from './lib/calendarToolExecutorServer';

// Hooks
export { useCalendarOAuth } from './hooks/useCalendarOAuth';

// Components
export { CalendarOAuthPanel } from './components/CalendarOAuthPanel';
