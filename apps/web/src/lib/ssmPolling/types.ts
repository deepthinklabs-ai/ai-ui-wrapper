/**
 * SSM Polling Types
 *
 * Types used across all polling modules.
 */

import type { SSMEvent, SSMAlert, SSMRulesConfig, SSMResponseTemplate, SSMSheetsActionConfig } from '@/app/canvas/types/ssm';
import type { SSMAutoReplyConfig } from '@/app/canvas/features/ssm-agent/features/auto-reply/types';
import type { SSMServerConfig, SSMPollingSettings } from '@/lib/ssmServerConfig/types';

/**
 * Source of the poll operation
 */
export type PollSource = 'cron' | 'manual';

/**
 * Options for a poll operation
 */
export interface PollOptions {
  /** Source of the poll (cron or manual) */
  source: PollSource;
  /** Whether to log detailed info (avoid in cron for no plaintext logging) */
  verbose?: boolean;
}

/**
 * Result of fetching events from a data source
 */
export interface FetchEventsResult {
  /** Successfully fetched events */
  events: SSMEvent[];
  /** Error message if fetch failed */
  error?: string;
  /** Updated sync token (for incremental sync) */
  syncToken?: string;
  /** Updated history ID (for Gmail incremental sync) */
  historyId?: string;
}

/**
 * Result of matching events against rules
 */
export interface MatchResult {
  /** Generated alerts */
  alerts: SSMAlert[];
  /** Number of events that matched rules */
  matched_count: number;
  /** Event IDs that were processed */
  processed_event_ids: string[];
}

/**
 * Result of processing auto-replies
 */
export interface AutoReplyResult {
  /** Number of replies sent */
  sent_count: number;
  /** Number of replies rate limited */
  rate_limited_count: number;
  /** Number of replies failed */
  failed_count: number;
  /** Errors encountered */
  errors: string[];
}

/**
 * Result of sheets logging operation
 */
export interface SheetsLogResult {
  /** Whether logging was successful */
  success: boolean;
  /** Spreadsheet ID used */
  spreadsheetId?: string;
  /** Number of rows logged */
  rows_logged: number;
  /** Error message if failed */
  error?: string;
}

/**
 * Full result of a poll operation
 */
export interface PollResult {
  /** Whether polling completed successfully */
  success: boolean;
  /** Error message if failed */
  error?: string;
  /** Number of events fetched */
  events_fetched: number;
  /** Number of alerts generated */
  alerts_generated: number;
  /** Number of auto-replies sent */
  auto_replies_sent: number;
  /** Number of rows logged to sheets */
  sheets_rows_logged: number;
  /** Generated alerts */
  alerts: SSMAlert[];
  /** Execution duration in ms */
  duration_ms: number;
  /** Source of the poll operation */
  source: PollSource;
  /** Updated Gmail history ID (for incremental sync) */
  gmail_history_id?: string;
  /** Updated Calendar sync token (for incremental sync) */
  calendar_sync_token?: string;
  /** Event IDs that were processed */
  processed_event_ids: string[];
}

/**
 * Polling configuration (subset of SSMServerConfig for polling)
 */
export interface PollingConfig {
  /** Rules for matching events */
  rules: SSMRulesConfig;
  /** Response templates for alerts */
  response_templates: SSMResponseTemplate[];
  /** Auto-reply configuration */
  auto_reply?: SSMAutoReplyConfig;
  /** Sheets logging action configuration */
  sheets_action?: SSMSheetsActionConfig;
  /** Polling settings */
  polling_settings: SSMPollingSettings;
  /** User ID */
  user_id: string;
  /** Node ID */
  node_id: string;
  /** Canvas ID */
  canvas_id: string;
}

/**
 * Runtime state for a node (stored in runtime_config)
 */
export interface NodeRuntimeState {
  name?: string;
  is_enabled?: boolean;
  trained_at?: string;
  trained_by?: string;
  gmail_enabled?: boolean;
  gmail_connection_id?: string;
  calendar_enabled?: boolean;
  calendar_connection_id?: string;
  events_processed?: number;
  alerts_triggered?: number;
  processed_event_ids?: string[];
  last_event_at?: string;
}

/**
 * Convert SSMServerConfig to PollingConfig
 */
export function toPollingConfig(serverConfig: SSMServerConfig): PollingConfig {
  return {
    rules: serverConfig.rules,
    response_templates: serverConfig.response_templates,
    auto_reply: serverConfig.auto_reply,
    sheets_action: serverConfig.sheets_action,
    polling_settings: serverConfig.polling_settings,
    user_id: serverConfig.user_id,
    node_id: serverConfig.node_id,
    canvas_id: serverConfig.canvas_id,
  };
}
