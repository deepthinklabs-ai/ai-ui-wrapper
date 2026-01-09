/**
 * SSM (State-Space Model) Node Type Definitions
 *
 * A rules-based event monitoring system that:
 * - Uses LLM ONLY at setup time to generate rules
 * - Runs on pure pattern matching at runtime ($0 cost)
 * - Pre-defines response templates for each scenario
 *
 * Architecture:
 * - Setup: User describes what to monitor → LLM generates rules/templates
 * - Runtime: Events matched against rules → Pre-defined responses
 * - AI Agent: Only invoked for critical alerts (user's choice)
 */

import type { GmailOAuthConfig } from '../features/gmail-oauth/types';
import type { CalendarOAuthConfig } from '../features/calendar-oauth/types';
import type { SheetsOAuthConfig } from '../features/sheets-oauth/types';
import type { DocsOAuthConfig } from '../features/docs-oauth/types';
import type { SlackOAuthConfig } from '../features/slack-oauth/types';
import type { SSMAutoReplyConfig } from '../features/ssm-agent/features/auto-reply/types';

// ============================================================================
// ALERT SEVERITY
// ============================================================================

/**
 * Severity levels for alerts
 */
export type SSMAlertSeverity = 'info' | 'warning' | 'critical';

// ============================================================================
// RULES CONFIGURATION
// ============================================================================

/**
 * A keyword rule for matching events
 */
export interface SSMKeywordRule {
  id: string;
  keyword: string;
  caseSensitive: boolean;
  severity: SSMAlertSeverity;
  enabled: boolean;
}

/**
 * A pattern rule using regex for matching events
 */
export interface SSMPatternRule {
  id: string;
  name: string;
  pattern: string;        // Regex pattern
  description: string;    // Human-readable description
  severity: SSMAlertSeverity;
  enabled: boolean;
}

/**
 * Supported operators for condition rules
 */
export type SSMConditionOperator =
  | 'equals' | '==' | '==='
  | 'contains' | 'includes'
  | 'startsWith'
  | 'endsWith'
  | 'greaterThan'
  | 'lessThan'
  | 'matches';

/**
 * A condition rule for field-based matching
 */
export interface SSMConditionRule {
  id: string;
  field: string;          // Field to check (e.g., "sender", "subject", "amount")
  operator: SSMConditionOperator;
  value: string;
  severity: SSMAlertSeverity;
  enabled: boolean;
}

/**
 * All rules for an SSM node
 */
export interface SSMRulesConfig {
  keywords: SSMKeywordRule[];
  patterns: SSMPatternRule[];
  conditions: SSMConditionRule[];
  /**
   * Logic mode for combining rules:
   * - 'any' (OR): Alert if ANY rule matches (default)
   * - 'all' (AND): Alert only if ALL enabled rules match
   */
  logic?: 'any' | 'all';
}

// ============================================================================
// RESPONSE TEMPLATES
// ============================================================================

/**
 * Actions that can be taken when rules match
 */
export type SSMResponseAction = 'log' | 'alert' | 'forward_to_ai' | 'send_reply';

/**
 * A response template for a specific severity level
 * Uses placeholders like {sender}, {subject}, {matched_rule}
 */
export interface SSMResponseTemplate {
  severity: SSMAlertSeverity;
  title: string;           // Template for alert title
  message: string;         // Template for alert message
  action: SSMResponseAction;  // What to do when triggered
}

// ============================================================================
// EVENT SOURCE
// ============================================================================

/**
 * How the SSM receives events to monitor
 */
export type SSMEventSourceType =
  | 'canvas'    // Events from connected canvas nodes
  | 'webhook'   // Events pushed via webhook
  | 'polling'   // Periodically fetch events from a source
  | 'manual';   // Manual testing

/**
 * Polling source options
 */
export type SSMPollingSource = 'gmail' | 'slack' | 'custom_api';

// ============================================================================
// NODE CONFIGURATION
// ============================================================================

/**
 * SSM Agent Node Configuration
 * Defines all settings for a rules-based monitoring node
 */
export interface SSMAgentNodeConfig {
  // Identity
  name: string;
  description: string;

  // Monitoring enabled state (on/off switch)
  is_enabled: boolean;

  // What to monitor (user's plain English description)
  monitoring_description: string;

  // Training state
  trained_at?: string;           // When training was completed
  trained_by?: 'claude' | 'openai';  // Which provider was used
  training_summary?: string;     // Summary of what was trained (auto-generated)

  // Generated rules (created by LLM at setup)
  rules: SSMRulesConfig;

  // Response templates for each severity
  response_templates: SSMResponseTemplate[];

  // Event Source
  event_source_type: SSMEventSourceType;
  polling_source?: SSMPollingSource;
  polling_interval_seconds?: number;
  webhook_secret?: string;

  // Setup metadata
  rules_generated_at?: string;
  rules_generated_by?: 'claude' | 'openai' | 'manual';

  // Runtime stats
  events_processed?: number;
  alerts_triggered?: number;
  last_event_at?: string;

  // Processed event IDs to prevent duplicate counting
  processed_event_ids?: string[];

  // OAuth Integrations (for data source access)
  gmail?: GmailOAuthConfig;
  calendar?: CalendarOAuthConfig;
  sheets?: SheetsOAuthConfig;
  docs?: DocsOAuthConfig;
  slack?: SlackOAuthConfig;

  // Auto-reply configuration
  auto_reply?: SSMAutoReplyConfig;
}

// ============================================================================
// RUNTIME TYPES
// ============================================================================

/**
 * An event to be processed by the SSM
 */
export interface SSMEvent {
  id: string;
  timestamp: string;
  source: string;
  type: string;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Result of matching an event against rules
 */
export interface SSMMatchResult {
  matched: boolean;
  severity: SSMAlertSeverity | null;
  matched_rules: Array<{
    type: 'keyword' | 'pattern' | 'condition';
    rule_id: string;
    rule_name: string;
  }>;
}

/**
 * Alert generated by SSM monitoring
 */
export interface SSMAlert {
  id: string;
  severity: SSMAlertSeverity;
  title: string;
  message: string;
  event_id: string;
  matched_rules: string[];
  timestamp: string;
  acknowledged: boolean;
  source_node_id: string;
  forwarded_to_ai: boolean;
}

/**
 * SSM execution state for runtime tracking
 */
export interface SSMExecutionState {
  node_id: string;
  status: 'idle' | 'monitoring' | 'paused' | 'error';
  last_event_at?: string;
  events_processed: number;
  alerts_generated: number;
  error_message?: string;
}

// ============================================================================
// API TYPES
// ============================================================================

/**
 * Request to generate rules from a description
 */
export interface SSMGenerateRulesRequest {
  description: string;
  provider: 'claude' | 'openai';
  userId: string;        // Required for API key lookup
  examples?: string[];   // Optional example events to help generation
}

/**
 * Response from rule generation
 */
export interface SSMGenerateRulesResponse {
  success: boolean;
  rules?: SSMRulesConfig;
  response_templates?: SSMResponseTemplate[];
  error?: string;
}

/**
 * Request to process an event
 */
export interface SSMProcessEventRequest {
  event: SSMEvent;
  rules: SSMRulesConfig;
  response_templates: SSMResponseTemplate[];
}

/**
 * Response from event processing
 */
export interface SSMProcessEventResponse {
  matched: boolean;
  alert?: SSMAlert;
  action: 'none' | SSMResponseAction;
}
