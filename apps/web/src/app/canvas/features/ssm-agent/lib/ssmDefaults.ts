/**
 * SSM Agent Default Configurations
 *
 * Separated from component code for:
 * - Easy modification and testing
 * - Reusability across components
 * - Clear separation of concerns
 */

import type { SSMAgentNodeConfig, SSMModelProvider } from '../../../types/ssm';

// ============================================================================
// MODEL OPTIONS
// ============================================================================

/**
 * Available models per provider
 * Organized by provider with display label and available models
 */
export const SSM_MODEL_OPTIONS: Record<SSMModelProvider, { label: string; models: string[] }> = {
  ollama: {
    label: 'Ollama (Local)',
    models: ['mamba', 'mamba-2.8b', 'granite-mamba'],
  },
  vllm: {
    label: 'vLLM (Self-hosted)',
    models: ['state-spaces/mamba-2.8b', 'ibm/bamba-9b'],
  },
  huggingface: {
    label: 'Hugging Face',
    models: ['state-spaces/mamba-130m', 'state-spaces/mamba-2.8b-slimpj'],
  },
  replicate: {
    label: 'Replicate',
    models: ['ibm/granite-4.0-tiny', 'ibm/granite-4.0-small'],
  },
};

// ============================================================================
// MONITORING TYPE OPTIONS
// ============================================================================

/**
 * Monitoring type options with display labels and icons
 */
export const MONITORING_TYPE_OPTIONS = [
  {
    value: 'security_threat' as const,
    label: 'Security Threat Detection',
    icon: '🛡️',
    description: 'Detect potential security threats in logs and activity streams',
  },
  {
    value: 'anomaly_detection' as const,
    label: 'Anomaly Detection',
    icon: '📈',
    description: 'Identify unusual patterns or outliers in data streams',
  },
  {
    value: 'classification' as const,
    label: 'Classification',
    icon: '🏷️',
    description: 'Categorize incoming events into predefined labels',
  },
  {
    value: 'summarization' as const,
    label: 'Summarization',
    icon: '📝',
    description: 'Generate periodic summaries of activity streams',
  },
  {
    value: 'custom' as const,
    label: 'Custom Prompt',
    icon: '⚙️',
    description: 'Define custom monitoring logic with your own prompt',
  },
];

// ============================================================================
// EVENT SOURCE OPTIONS
// ============================================================================

/**
 * Event source type options
 */
export const EVENT_SOURCE_OPTIONS = [
  {
    value: 'manual' as const,
    label: 'Manual / Canvas',
    icon: '👆',
    description: 'Events triggered manually or from canvas connections',
  },
  {
    value: 'webhook' as const,
    label: 'Webhook',
    icon: '🔗',
    description: 'Events pushed to this node via HTTP webhook',
  },
  {
    value: 'polling' as const,
    label: 'Polling',
    icon: '🔄',
    description: 'Periodically fetch events from a source',
  },
  {
    value: 'pubsub' as const,
    label: 'Pub/Sub',
    icon: '📡',
    description: 'Subscribe to a Pub/Sub topic for real-time events',
  },
];

// ============================================================================
// OUTPUT FORMAT OPTIONS
// ============================================================================

/**
 * Output format options
 */
export const OUTPUT_FORMAT_OPTIONS = [
  {
    value: 'alert' as const,
    label: 'Alert (Structured)',
    description: 'Structured alert object with severity, title, and details',
  },
  {
    value: 'summary' as const,
    label: 'Summary (Prose)',
    description: 'Natural language summary of findings',
  },
  {
    value: 'classification' as const,
    label: 'Classification (Label)',
    description: 'Single classification label output',
  },
  {
    value: 'raw' as const,
    label: 'Raw (JSON)',
    description: 'Raw JSON response from the model',
  },
];

// ============================================================================
// POLLING SOURCE OPTIONS
// ============================================================================

/**
 * Available polling sources
 */
export const POLLING_SOURCE_OPTIONS = [
  { value: 'gmail' as const, label: 'Gmail', icon: '📧' },
  { value: 'slack' as const, label: 'Slack', icon: '💬' },
  { value: 'custom_api' as const, label: 'Custom API', icon: '🔌' },
];

// ============================================================================
// DEFAULT CONFIGURATION
// ============================================================================

/**
 * Default SSM agent node configuration
 * Used when creating new SSM nodes
 */
export const DEFAULT_SSM_CONFIG: SSMAgentNodeConfig = {
  name: 'SSM Monitor',
  description: '',
  model_provider: 'ollama',
  model_name: 'mamba',
  event_source_type: 'manual',
  monitoring_type: 'classification',
  output_format: 'alert',
  state_retention_hours: 24,
  checkpoint_enabled: true,
  alert_threshold: 0.7,
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get available models for a given provider
 */
export function getModelsForProvider(provider: SSMModelProvider): string[] {
  return SSM_MODEL_OPTIONS[provider]?.models || [];
}

/**
 * Get the display label for a provider
 */
export function getProviderLabel(provider: SSMModelProvider): string {
  return SSM_MODEL_OPTIONS[provider]?.label || provider;
}

/**
 * Get monitoring type info by value
 */
export function getMonitoringTypeInfo(type: string) {
  return MONITORING_TYPE_OPTIONS.find(opt => opt.value === type);
}

/**
 * Get default model for a provider
 */
export function getDefaultModelForProvider(provider: SSMModelProvider): string {
  const models = getModelsForProvider(provider);
  return models[0] || '';
}
