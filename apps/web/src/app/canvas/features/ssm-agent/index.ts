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
export {
  useSSMExecution,
  type SSMExecutionStatus,
  type SSMExecuteParams,
  type SSMExecuteResult,
  type UseSSMExecutionResult,
} from './hooks/useSSMExecution';

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

// Lib - Sanitization (Security)
export {
  sanitizeEventContent,
  sanitizeCustomPrompt,
  validateOllamaEndpoint,
  validateWebhookUrl,
  sanitizeNodeName,
  generateRequestId,
  getRateLimitKey,
  getUserRateLimitKey,
  INPUT_LIMITS,
  type SanitizationResult,
  type EndpointValidationResult,
} from './lib/ssmSanitization';

// Lib - Prompts
export {
  generatePrompt,
  generateBatchPrompt,
  parseAlertResponse,
  parseClassificationResponse,
  parseSummaryResponse,
  type PromptContext,
  type GeneratedPrompt,
  type ParsedAlertResponse,
  type ParsedClassificationResponse,
} from './lib/ssmPrompts';

// Lib - Ollama Client
export {
  executeSSMInference,
  checkEndpointHealth,
  listOllamaModels,
  type OllamaRequestOptions,
  type OllamaResponse,
} from './lib/ssmOllamaClient';
