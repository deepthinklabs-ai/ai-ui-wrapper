/**
 * SSM Server Config Types
 *
 * Types for SSM operational data stored with server-side encryption.
 * This config is accessible by server-side cron jobs for background polling.
 *
 * Security Boundary:
 * - Zero-knowledge content (password-encrypted): threads, system prompts
 * - Hosted automation data (server-encrypted): SSM rules, auto-reply, OAuth tokens
 */

import type {
  SSMRulesConfig,
  SSMResponseTemplate,
  SSMSheetsActionConfig,
} from '@/app/canvas/types/ssm';
import type { SSMAutoReplyConfig } from '@/app/canvas/features/ssm-agent/features/auto-reply/types';

/**
 * Polling settings for background execution
 */
export interface SSMPollingSettings {
  /** Gmail polling enabled */
  gmail_enabled: boolean;
  /** Gmail OAuth connection ID (references oauth_connections table) */
  gmail_connection_id?: string;
  /** Gmail history ID for incremental sync */
  gmail_history_id?: string;

  /** Calendar polling enabled */
  calendar_enabled: boolean;
  /** Calendar OAuth connection ID (references oauth_connections table) */
  calendar_connection_id?: string;
  /** Calendar sync token for incremental sync */
  calendar_sync_token?: string;

  /** Polling interval in minutes (default: 1) */
  interval_minutes: number;
}

/**
 * Full SSM server config stored encrypted in server_config_encrypted column
 */
export interface SSMServerConfig {
  /** Rule matching configuration */
  rules: SSMRulesConfig;

  /** Response templates for alerts */
  response_templates: SSMResponseTemplate[];

  /** Auto-reply configuration (optional) */
  auto_reply?: SSMAutoReplyConfig;

  /** Sheets logging action configuration (optional) */
  sheets_action?: SSMSheetsActionConfig;

  /** Polling settings for background execution */
  polling_settings: SSMPollingSettings;

  /** Config version for optimistic locking */
  version: number;

  /** User ID who owns this config */
  user_id: string;

  /** Node ID this config belongs to */
  node_id: string;

  /** Canvas ID this config belongs to */
  canvas_id: string;

  /** Timestamp when config was last synced */
  synced_at: string;
}

/**
 * Result of a polling operation
 */
export interface SSMPollResult {
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

  /** Execution duration in ms */
  duration_ms: number;

  /** Source of the poll operation */
  source: 'cron' | 'manual';

  /** Updated history ID (for Gmail incremental sync) */
  gmail_history_id?: string;

  /** Updated sync token (for Calendar incremental sync) */
  calendar_sync_token?: string;
}

/**
 * Audit fields stored on canvas_nodes table
 */
export interface SSMNodeAuditFields {
  /** Whether background polling is enabled for this node */
  background_polling_enabled: boolean;

  /** When server config was last synced */
  server_config_updated_at: string | null;

  /** Config version for optimistic locking */
  server_config_version: number;

  /** When last background poll was executed */
  last_background_poll_at: string | null;

  /** Last background poll error (null if successful) */
  background_poll_error: string | null;
}

/**
 * Default polling settings
 */
export const DEFAULT_POLLING_SETTINGS: SSMPollingSettings = {
  gmail_enabled: false,
  calendar_enabled: false,
  interval_minutes: 1,
};
