/**
 * SSM Agent Default Configurations
 *
 * Default values for the rules-based SSM monitoring system.
 *
 * Architecture:
 * - LLM used ONLY at setup time to generate rules
 * - Runtime uses pure pattern matching ($0 cost)
 */

import type {
  SSMAgentNodeConfig,
  SSMRulesConfig,
  SSMResponseTemplate,
  SSMEventSourceType,
  SSMPollingSource,
} from '../../../types/ssm';

// ============================================================================
// DEFAULT RULES (Empty)
// ============================================================================

export const DEFAULT_RULES: SSMRulesConfig = {
  keywords: [],
  patterns: [],
  conditions: [],
};

// ============================================================================
// DEFAULT RESPONSE TEMPLATES
// ============================================================================

export const DEFAULT_RESPONSE_TEMPLATES: SSMResponseTemplate[] = [
  {
    severity: 'info',
    title: 'Info: {matched_rule}',
    message: 'Event logged from {sender}: {content_preview}',
    action: 'log',
  },
  {
    severity: 'warning',
    title: 'Warning: {matched_rule}',
    message: 'Suspicious activity detected from {sender}: {content_preview}. Matched rules: {matched_keywords}',
    action: 'alert',
  },
  {
    severity: 'critical',
    title: 'CRITICAL: {matched_rule}',
    message: 'Immediate attention required! Source: {sender}. Details: {content_preview}. This matched critical rules: {matched_keywords}',
    action: 'forward_to_ai',
  },
];

// ============================================================================
// DEFAULT NODE CONFIG
// ============================================================================

export const DEFAULT_SSM_CONFIG: SSMAgentNodeConfig = {
  name: 'Stream Monitor',
  description: '',
  is_enabled: false, // Off by default until configured
  monitoring_description: '',
  rules: DEFAULT_RULES,
  response_templates: DEFAULT_RESPONSE_TEMPLATES,
  event_source_type: 'canvas',
  events_processed: 0,
  alerts_triggered: 0,
};

// ============================================================================
// EVENT SOURCE OPTIONS
// ============================================================================

export const EVENT_SOURCE_OPTIONS: Array<{
  value: SSMEventSourceType;
  label: string;
  description: string;
  icon: string;
}> = [
  {
    value: 'canvas',
    label: 'Canvas Connection',
    description: 'Receive events from connected nodes',
    icon: '🔗',
  },
  {
    value: 'webhook',
    label: 'Webhook',
    description: 'Receive events via HTTP webhook',
    icon: '🌐',
  },
  {
    value: 'polling',
    label: 'Polling',
    description: 'Periodically fetch events from a source',
    icon: '🔄',
  },
  {
    value: 'manual',
    label: 'Manual / Test',
    description: 'Manually trigger events for testing',
    icon: '✋',
  },
];

// ============================================================================
// POLLING SOURCE OPTIONS
// ============================================================================

export const POLLING_SOURCE_OPTIONS: Array<{
  value: SSMPollingSource;
  label: string;
  icon: string;
}> = [
  { value: 'gmail', label: 'Gmail', icon: '📧' },
  { value: 'slack', label: 'Slack', icon: '💬' },
  { value: 'custom_api', label: 'Custom API', icon: '🔌' },
];

// ============================================================================
// AI PROVIDER OPTIONS (for rule generation only)
// ============================================================================

export const AI_PROVIDER_OPTIONS: Array<{
  value: 'claude' | 'openai';
  label: string;
  description: string;
}> = [
  {
    value: 'claude',
    label: 'Claude (Haiku)',
    description: 'Fast and cost-effective',
  },
  {
    value: 'openai',
    label: 'OpenAI (GPT-4o-mini)',
    description: 'Fast and cost-effective',
  },
];

// ============================================================================
// EXAMPLE MONITORING DESCRIPTIONS
// ============================================================================

export const MONITORING_EXAMPLES = [
  {
    title: 'Phishing Detection',
    description: 'Detect phishing attempts, suspicious links, urgent money requests, and emails pretending to be from executives or known services.',
  },
  {
    title: 'Security Alerts',
    description: 'Monitor for failed login attempts, password reset requests, new device logins, and suspicious IP addresses.',
  },
  {
    title: 'Compliance Monitoring',
    description: 'Flag messages containing sensitive data like SSN, credit card numbers, or confidential information being shared externally.',
  },
  {
    title: 'Customer Sentiment',
    description: 'Identify angry or frustrated customer messages, complaints, escalation requests, and negative feedback.',
  },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get event source info
 */
export function getEventSourceInfo(type: SSMEventSourceType) {
  return EVENT_SOURCE_OPTIONS.find(opt => opt.value === type);
}

/**
 * Generate a unique rule ID
 */
export function generateRuleId(prefix: 'kw' | 'pat' | 'cond'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

/**
 * Check if rules have been configured
 */
export function hasRulesConfigured(rules: SSMRulesConfig): boolean {
  return (
    rules.keywords.length > 0 ||
    rules.patterns.length > 0 ||
    rules.conditions.length > 0
  );
}

/**
 * Count total enabled rules
 */
export function countEnabledRules(rules: SSMRulesConfig): number {
  return (
    rules.keywords.filter(r => r.enabled).length +
    rules.patterns.filter(r => r.enabled).length +
    rules.conditions.filter(r => r.enabled).length
  );
}
