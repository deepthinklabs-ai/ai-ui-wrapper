/**
 * SSM Agent Configuration Validation
 *
 * Ensures config integrity before save.
 * Separated from component code for:
 * - Reusability
 * - Unit testing
 * - Clear separation of concerns
 */

import type { SSMAgentNodeConfig } from '../../../types/ssm';
import { SSM_MODEL_OPTIONS } from './ssmDefaults';

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

  if (!config.model_provider) {
    errors.push('Model provider is required');
  }

  if (!config.model_name) {
    errors.push('Model name is required');
  }

  // Provider-specific validation
  if (config.model_provider === 'ollama' && !config.model_endpoint) {
    // Set default endpoint for Ollama if not specified
    warnings.push('Ollama endpoint not set, will use default (http://localhost:11434)');
  }

  if (config.model_provider === 'vllm' && !config.model_endpoint) {
    warnings.push('vLLM endpoint not set, will use default (http://localhost:8000)');
  }

  // Validate model exists for provider
  if (config.model_provider && config.model_name) {
    const availableModels = SSM_MODEL_OPTIONS[config.model_provider]?.models || [];
    if (!availableModels.includes(config.model_name)) {
      warnings.push(`Model "${config.model_name}" may not be available for ${config.model_provider}`);
    }
  }

  // Custom monitoring type requires prompt
  if (config.monitoring_type === 'custom' && !config.custom_prompt?.trim()) {
    errors.push('Custom prompt is required when using custom monitoring type');
  }

  // Alert threshold validation
  if (config.alert_threshold !== undefined) {
    if (config.alert_threshold < 0 || config.alert_threshold > 1) {
      errors.push('Alert threshold must be between 0 and 1');
    }
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

  // State retention validation
  if (config.state_retention_hours !== undefined) {
    if (config.state_retention_hours < 1) {
      errors.push('State retention must be at least 1 hour');
    }
    if (config.state_retention_hours > 720) {
      warnings.push('State retention over 30 days (720 hours) may impact storage');
    }
  }

  // Alert webhook validation
  if (config.alert_webhook) {
    try {
      new URL(config.alert_webhook);
    } catch {
      errors.push('Alert webhook must be a valid URL');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
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

    case 'model_provider':
      if (!value || !Object.keys(SSM_MODEL_OPTIONS).includes(value as string)) {
        return 'Invalid model provider';
      }
      break;

    case 'alert_threshold':
      if (value !== undefined) {
        const num = Number(value);
        if (isNaN(num) || num < 0 || num > 1) {
          return 'Alert threshold must be between 0 and 1';
        }
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

    case 'custom_prompt':
      if (currentConfig.monitoring_type === 'custom' && (!value || typeof value !== 'string' || !value.trim())) {
        return 'Custom prompt is required for custom monitoring';
      }
      break;

    case 'alert_webhook':
      if (value && typeof value === 'string' && value.trim()) {
        try {
          new URL(value);
        } catch {
          return 'Alert webhook must be a valid URL';
        }
      }
      break;
  }

  return null;
}

/**
 * Apply default values to config where missing
 */
export function applySSMDefaults(config: Partial<SSMAgentNodeConfig>): SSMAgentNodeConfig {
  const result: SSMAgentNodeConfig = {
    name: config.name || 'SSM Monitor',
    description: config.description || '',
    model_provider: config.model_provider || 'ollama',
    model_name: config.model_name || 'mamba',
    event_source_type: config.event_source_type || 'manual',
    monitoring_type: config.monitoring_type || 'classification',
    output_format: config.output_format || 'alert',
    state_retention_hours: config.state_retention_hours ?? 24,
    checkpoint_enabled: config.checkpoint_enabled ?? true,
    alert_threshold: config.alert_threshold ?? 0.7,
    ...config,
  };

  // Apply default endpoints for self-hosted providers
  if (result.model_provider === 'ollama' && !result.model_endpoint) {
    result.model_endpoint = 'http://localhost:11434';
  }
  if (result.model_provider === 'vllm' && !result.model_endpoint) {
    result.model_endpoint = 'http://localhost:8000';
  }

  return result;
}
