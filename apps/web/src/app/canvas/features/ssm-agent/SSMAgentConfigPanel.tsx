/**
 * SSMAgentConfigPanel Component
 *
 * Configuration interface for SSM Agent nodes.
 * Organized into logical sections following existing Canvas patterns.
 *
 * Sections:
 * 1. Identity - Name and description
 * 2. Model Configuration - Provider and model selection
 * 3. Monitoring - Type, prompt, and threshold
 * 4. Event Source - How events are received
 * 5. Output - Format and alert settings
 * 6. State Management - Retention and checkpointing
 */

'use client';

import React from 'react';
import type { SSMAgentNodeConfig, SSMModelProvider } from '../../types/ssm';
import { useSSMConfig } from './hooks/useSSMConfig';
import {
  SSM_MODEL_OPTIONS,
  MONITORING_TYPE_OPTIONS,
  EVENT_SOURCE_OPTIONS,
  OUTPUT_FORMAT_OPTIONS,
  POLLING_SOURCE_OPTIONS,
} from './lib/ssmDefaults';

// ============================================================================
// TYPES
// ============================================================================

interface SSMAgentConfigPanelProps {
  config: SSMAgentNodeConfig;
  onUpdate: (updates: Partial<SSMAgentNodeConfig>) => Promise<boolean>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SSMAgentConfigPanel({ config, onUpdate }: SSMAgentConfigPanelProps) {
  const {
    config: formConfig,
    updateField,
    updateProvider,
    availableModels,
    errors,
    warnings,
    isDirty,
    isSaving,
  } = useSSMConfig({
    initialConfig: config,
    onSave: async (newConfig) => {
      await onUpdate(newConfig);
      return true;
    },
    autoSaveDelay: 500,
  });

  return (
    <div className="space-y-6 p-4">
      {/* Validation Messages */}
      {errors.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <ul className="text-sm text-red-600 list-disc list-inside space-y-1">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <ul className="text-sm text-amber-600 list-disc list-inside space-y-1">
            {warnings.map((warning, i) => (
              <li key={i}>{warning}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Section: Identity */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <span>📋</span> Identity
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-foreground/60 mb-1">Name</label>
            <input
              type="text"
              value={formConfig.name}
              onChange={(e) => updateField('name', e.target.value)}
              className="w-full px-3 py-2 border border-foreground/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="SSM Monitor"
            />
          </div>
          <div>
            <label className="block text-xs text-foreground/60 mb-1">Description</label>
            <textarea
              value={formConfig.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-foreground/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
              placeholder="What does this SSM monitor?"
            />
          </div>
        </div>
      </section>

      {/* Section: Model Configuration */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <span>🧠</span> SSM Model
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-foreground/60 mb-1">Provider</label>
            <select
              value={formConfig.model_provider}
              onChange={(e) => updateProvider(e.target.value as SSMModelProvider)}
              className="w-full px-3 py-2 border border-foreground/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {Object.entries(SSM_MODEL_OPTIONS).map(([key, { label }]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-foreground/60 mb-1">Model</label>
            <select
              value={formConfig.model_name}
              onChange={(e) => updateField('model_name', e.target.value)}
              className="w-full px-3 py-2 border border-foreground/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {availableModels.map((model) => (
                <option key={model} value={model}>{model}</option>
              ))}
            </select>
          </div>
          {(formConfig.model_provider === 'ollama' || formConfig.model_provider === 'vllm') && (
            <div>
              <label className="block text-xs text-foreground/60 mb-1">
                {formConfig.model_provider === 'ollama' ? 'Ollama' : 'vLLM'} Endpoint
              </label>
              <input
                type="text"
                value={formConfig.model_endpoint || ''}
                onChange={(e) => updateField('model_endpoint', e.target.value)}
                className="w-full px-3 py-2 border border-foreground/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder={formConfig.model_provider === 'ollama' ? 'http://localhost:11434' : 'http://localhost:8000'}
              />
            </div>
          )}
        </div>
      </section>

      {/* Section: Monitoring */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <span>👁️</span> Monitoring
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-foreground/60 mb-2">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {MONITORING_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateField('monitoring_type', option.value)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors text-left
                    ${formConfig.monitoring_type === option.value
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-foreground/20 hover:border-foreground/30 bg-white'
                    }
                  `}
                  title={option.description}
                >
                  <span>{option.icon}</span>
                  <span className="text-xs truncate">{option.label}</span>
                </button>
              ))}
            </div>
          </div>
          {formConfig.monitoring_type === 'custom' && (
            <div>
              <label className="block text-xs text-foreground/60 mb-1">Custom Prompt</label>
              <textarea
                value={formConfig.custom_prompt || ''}
                onChange={(e) => updateField('custom_prompt', e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-foreground/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
                placeholder="Describe what the SSM should monitor for..."
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-foreground/60 mb-1">
              Alert Threshold: {((formConfig.alert_threshold || 0.7) * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={formConfig.alert_threshold || 0.7}
              onChange={(e) => updateField('alert_threshold', parseFloat(e.target.value))}
              className="w-full accent-teal-500"
            />
            <div className="flex justify-between text-xs text-foreground/50 mt-1">
              <span>More alerts</span>
              <span>Fewer alerts</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section: Event Source */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <span>📡</span> Event Source
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-foreground/60 mb-2">Source Type</label>
            <div className="grid grid-cols-2 gap-2">
              {EVENT_SOURCE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => updateField('event_source_type', option.value)}
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors text-left
                    ${formConfig.event_source_type === option.value
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-foreground/20 hover:border-foreground/30 bg-white'
                    }
                  `}
                  title={option.description}
                >
                  <span>{option.icon}</span>
                  <span className="text-xs">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          {formConfig.event_source_type === 'polling' && (
            <>
              <div>
                <label className="block text-xs text-foreground/60 mb-1">Polling Source</label>
                <select
                  value={formConfig.polling_source || ''}
                  onChange={(e) => updateField('polling_source', e.target.value as 'gmail' | 'slack' | 'custom_api')}
                  className="w-full px-3 py-2 border border-foreground/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">Select source...</option>
                  {POLLING_SOURCE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.icon} {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-foreground/60 mb-1">
                  Polling Interval: {formConfig.polling_interval_seconds || 60}s
                </label>
                <input
                  type="range"
                  min="10"
                  max="3600"
                  step="10"
                  value={formConfig.polling_interval_seconds || 60}
                  onChange={(e) => updateField('polling_interval_seconds', parseInt(e.target.value))}
                  className="w-full accent-teal-500"
                />
                <div className="flex justify-between text-xs text-foreground/50 mt-1">
                  <span>10s</span>
                  <span>1 hour</span>
                </div>
              </div>
            </>
          )}

          {formConfig.event_source_type === 'webhook' && (
            <div>
              <label className="block text-xs text-foreground/60 mb-1">Webhook Secret</label>
              <input
                type="password"
                value={formConfig.webhook_secret || ''}
                onChange={(e) => updateField('webhook_secret', e.target.value)}
                className="w-full px-3 py-2 border border-foreground/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                placeholder="Optional security secret"
              />
            </div>
          )}
        </div>
      </section>

      {/* Section: Output */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <span>📤</span> Output
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-foreground/60 mb-1">Format</label>
            <select
              value={formConfig.output_format}
              onChange={(e) => updateField('output_format', e.target.value as SSMAgentNodeConfig['output_format'])}
              className="w-full px-3 py-2 border border-foreground/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              {OUTPUT_FORMAT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <p className="text-xs text-foreground/50 mt-1">
              {OUTPUT_FORMAT_OPTIONS.find(o => o.value === formConfig.output_format)?.description}
            </p>
          </div>
          <div>
            <label className="block text-xs text-foreground/60 mb-1">Alert Webhook (Optional)</label>
            <input
              type="url"
              value={formConfig.alert_webhook || ''}
              onChange={(e) => updateField('alert_webhook', e.target.value)}
              className="w-full px-3 py-2 border border-foreground/20 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              placeholder="https://your-service.com/webhook"
            />
          </div>
        </div>
      </section>

      {/* Section: State Management */}
      <section>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <span>💾</span> State Management
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-foreground/60 mb-1">
              State Retention: {formConfig.state_retention_hours || 24} hours
            </label>
            <input
              type="range"
              min="1"
              max="720"
              step="1"
              value={formConfig.state_retention_hours || 24}
              onChange={(e) => updateField('state_retention_hours', parseInt(e.target.value))}
              className="w-full accent-teal-500"
            />
            <div className="flex justify-between text-xs text-foreground/50 mt-1">
              <span>1 hour</span>
              <span>30 days</span>
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formConfig.checkpoint_enabled ?? true}
              onChange={(e) => updateField('checkpoint_enabled', e.target.checked)}
              className="w-4 h-4 rounded border-foreground/20 text-teal-500 focus:ring-teal-500"
            />
            <div>
              <span className="text-sm text-foreground">Enable Checkpointing</span>
              <p className="text-xs text-foreground/50">Save SSM state periodically for recovery</p>
            </div>
          </label>
        </div>
      </section>

      {/* Info Box */}
      <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg">
        <div className="flex items-start gap-2">
          <span className="text-teal-600">📊</span>
          <div>
            <p className="text-xs text-teal-700 font-medium">State-Space Models</p>
            <p className="text-xs text-teal-600 mt-1">
              SSMs use linear O(n) complexity for efficient continuous monitoring.
              Ideal for high-volume streams like email inboxes and security logs.
            </p>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      {(isDirty || isSaving) && (
        <div className="flex items-center justify-end gap-2 text-xs text-foreground/50">
          {isSaving && (
            <>
              <div className="w-3 h-3 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              <span>Saving...</span>
            </>
          )}
          {isDirty && !isSaving && (
            <span>Unsaved changes</span>
          )}
        </div>
      )}
    </div>
  );
}
