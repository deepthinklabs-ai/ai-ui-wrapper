/**
 * SSM Agent Feature Module
 *
 * Public exports for the Stream Monitor feature.
 * Rules-based event monitoring with $0 runtime cost.
 *
 * Architecture:
 * - LLM used ONLY at setup time to generate rules (~$0.01 one-time)
 * - Runtime uses pure pattern matching ($0 cost)
 * - Pre-defined response templates for each severity
 *
 * @example
 * import { SSMAgentConfigPanel, matchEvent, generateAlert } from '@/app/canvas/features/ssm-agent';
 */

// Components
export { default as SSMAgentConfigPanel } from './SSMAgentConfigPanel';

// Hooks
export { useSSMConfig } from './hooks/useSSMConfig';

// Lib - Defaults & Configuration
export {
  DEFAULT_RULES,
  DEFAULT_RESPONSE_TEMPLATES,
  DEFAULT_SSM_CONFIG,
  EVENT_SOURCE_OPTIONS,
  POLLING_SOURCE_OPTIONS,
  AI_PROVIDER_OPTIONS,
  MONITORING_EXAMPLES,
  getEventSourceInfo,
  generateRuleId,
  hasRulesConfigured,
  countEnabledRules,
} from './lib/ssmDefaults';

// Lib - Rules Engine (Runtime - $0 cost)
export {
  matchEvent,
  generateAlert,
  validateRegexPattern,
  testRules,
  getRuleStats,
} from './lib/ssmRulesEngine';

// Lib - Validation
export {
  validateSSMConfig,
  validateSSMField,
  applySSMDefaults,
  type ValidationResult,
} from './lib/ssmValidation';
