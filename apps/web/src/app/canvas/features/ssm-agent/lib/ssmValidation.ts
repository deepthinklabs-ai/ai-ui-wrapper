/**
 * SSM Agent Configuration Validation
 *
 * Validates rules-based Stream Monitor configuration.
 * Ensures rules and templates are properly configured.
 */

import type { SSMAgentNodeConfig, SSMRulesConfig } from '../../../types/ssm';
import { DEFAULT_SSM_CONFIG, DEFAULT_RESPONSE_TEMPLATES } from './ssmDefaults';

// ============================================================================
// VALIDATION RESULT TYPE
// ============================================================================

/**
 * Result of config validation
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate the full SSM agent configuration
 */
export function validateSSMConfig(config: SSMAgentNodeConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!config.name?.trim()) {
    errors.push('Name is required');
  }

  // Monitoring description
  if (!config.monitoring_description?.trim()) {
    warnings.push('No monitoring description set - rules may not be configured yet');
  }

  // Rules validation
  if (config.rules) {
    const rulesResult = validateRules(config.rules);
    errors.push(...rulesResult.errors);
    warnings.push(...rulesResult.warnings);
  }

  // Response templates validation
  if (!config.response_templates || config.response_templates.length === 0) {
    warnings.push('No response templates configured - using defaults');
  }

  // Polling configuration validation
  if (config.event_source_type === 'polling') {
    if (!config.polling_source) {
      errors.push('Polling source is required when using polling event source');
    }
    if (config.polling_interval_seconds !== undefined) {
      if (config.polling_interval_seconds < 10) {
        errors.push('Polling interval must be at least 10 seconds');
      }
      if (config.polling_interval_seconds > 86400) {
        errors.push('Polling interval cannot exceed 24 hours (86400 seconds)');
      }
    }
  }

  // Webhook configuration validation
  if (config.event_source_type === 'webhook') {
    if (!config.webhook_secret) {
      warnings.push('Webhook secret not set - webhook will be unsecured');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate rules configuration
 */
function validateRules(rules: SSMRulesConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if any rules exist
  const totalRules =
    (rules.keywords?.length || 0) +
    (rules.patterns?.length || 0) +
    (rules.conditions?.length || 0);

  if (totalRules === 0) {
    warnings.push('No rules configured - monitor will not detect any events');
  }

  // Validate keyword rules
  for (const keyword of rules.keywords || []) {
    if (!keyword.keyword?.trim()) {
      errors.push(`Keyword rule ${keyword.id} has empty keyword`);
    }
  }

  // Validate pattern rules (regex)
  for (const pattern of rules.patterns || []) {
    if (!pattern.pattern?.trim()) {
      errors.push(`Pattern rule ${pattern.id} has empty pattern`);
    } else {
      try {
        new RegExp(pattern.pattern);
      } catch (e) {
        errors.push(`Pattern rule "${pattern.name}" has invalid regex: ${e instanceof Error ? e.message : 'unknown error'}`);
      }
    }
  }

  // Validate condition rules
  for (const condition of rules.conditions || []) {
    if (!condition.field?.trim()) {
      errors.push(`Condition rule ${condition.id} has no field specified`);
    }
    if (!condition.value?.trim()) {
      errors.push(`Condition rule ${condition.id} has no value specified`);
    }
    if (condition.operator === 'matches') {
      try {
        new RegExp(condition.value);
      } catch (e) {
        errors.push(`Condition rule with "matches" operator has invalid regex: ${e instanceof Error ? e.message : 'unknown error'}`);
      }
    }
  }

  return { isValid: errors.length === 0, errors, warnings };
}

/**
 * Validate a single field
 */
export function validateSSMField(
  field: keyof SSMAgentNodeConfig,
  value: unknown,
  currentConfig: SSMAgentNodeConfig
): string | null {
  switch (field) {
    case 'name':
      if (!value || typeof value !== 'string' || !value.trim()) {
        return 'Name is required';
      }
      break;

    case 'polling_interval_seconds':
      if (value !== undefined) {
        const num = Number(value);
        if (isNaN(num) || num < 10 || num > 86400) {
          return 'Polling interval must be between 10 seconds and 24 hours';
        }
      }
      break;

    case 'monitoring_description':
      if (typeof value === 'string' && value.trim().length > 0 && value.trim().length < 10) {
        return 'Description should be at least 10 characters for good rule generation';
      }
      break;
  }

  return null;
}

/**
 * Apply default values to config where missing
 */
export function applySSMDefaults(config: Partial<SSMAgentNodeConfig>): SSMAgentNodeConfig {
  return {
    ...DEFAULT_SSM_CONFIG,
    ...config,
    rules: config.rules || DEFAULT_SSM_CONFIG.rules,
    response_templates: config.response_templates || DEFAULT_RESPONSE_TEMPLATES,
  };
}
