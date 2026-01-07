/**
 * SSM Agent Feature Module
 *
 * Public exports for the SSM Agent feature.
 * Import from this file to use SSM agent functionality.
 *
 * @example
 * import { SSMAgentConfigPanel, useSSMConfig } from '@/app/canvas/features/ssm-agent';
 */

// Components
export { default as SSMAgentConfigPanel } from './SSMAgentConfigPanel';

// Hooks
export { useSSMConfig } from './hooks/useSSMConfig';

// Lib - Defaults
export {
  SSM_MODEL_OPTIONS,
  MONITORING_TYPE_OPTIONS,
  EVENT_SOURCE_OPTIONS,
  OUTPUT_FORMAT_OPTIONS,
  POLLING_SOURCE_OPTIONS,
  DEFAULT_SSM_CONFIG,
  getModelsForProvider,
  getProviderLabel,
  getMonitoringTypeInfo,
  getDefaultModelForProvider,
} from './lib/ssmDefaults';

// Lib - Validation
export {
  validateSSMConfig,
  validateSSMField,
  applySSMDefaults,
  type ValidationResult,
} from './lib/ssmValidation';
