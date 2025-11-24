'use client';

/**
 * Genesis Bot Configuration Panel
 *
 * Full configuration UI for Genesis Bot nodes in the Canvas.
 * Allows editing model, system prompt, temperature, and other settings.
 */

import React, { useState, useEffect } from 'react';
import type { GenesisBotNodeConfig } from '../../types';
import { AVAILABLE_MODELS, type AIModel } from '@/lib/apiKeyStorage';

interface GenesisBotConfigPanelProps {
  config: GenesisBotNodeConfig;
  onUpdate: (updates: Partial<GenesisBotNodeConfig>) => void;
}

export default function GenesisBotConfigPanel({
  config,
  onUpdate,
}: GenesisBotConfigPanelProps) {
  // Local state for form fields
  const [formData, setFormData] = useState<GenesisBotNodeConfig>(config);

  // Sync with prop changes
  useEffect(() => {
    setFormData(config);
  }, [config]);

  // Handle field changes
  const handleChange = (field: keyof GenesisBotNodeConfig, value: any) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
  };

  // Handle blur (save)
  const handleBlur = (field: keyof GenesisBotNodeConfig) => {
    if (formData[field] !== config[field]) {
      onUpdate({ [field]: formData[field] });
    }
  };

  // Get models for the selected provider
  const availableModelsForProvider = AVAILABLE_MODELS.filter(
    (m) => m.provider === formData.model_provider
  );

  return (
    <div className="space-y-4">
      {/* Model Configuration */}
      <div>
        <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          AI Model
        </h5>

        {/* Model Provider */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-300 mb-2">
            Provider
          </label>
          <select
            value={formData.model_provider}
            onChange={(e) => {
              const provider = e.target.value as 'openai' | 'claude' | 'grok';

              // Auto-select first model of new provider
              const firstModel = AVAILABLE_MODELS.find((m) => m.provider === provider);

              // Update both provider and model immediately
              if (firstModel) {
                onUpdate({
                  model_provider: provider,
                  model_name: firstModel.value,
                });
              } else {
                onUpdate({ model_provider: provider });
              }
            }}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="openai">OpenAI</option>
            <option value="claude">Claude (Anthropic)</option>
            <option value="grok">Grok (xAI)</option>
          </select>
        </div>

        {/* Model Name */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-2">
            Model
          </label>
          <select
            value={formData.model_name}
            onChange={(e) => handleChange('model_name', e.target.value as AIModel)}
            onBlur={() => handleBlur('model_name')}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            {availableModelsForProvider.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            {availableModelsForProvider.find((m) => m.value === formData.model_name)
              ?.description}
          </p>
        </div>
      </div>

      {/* System Prompt */}
      <div>
        <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Behavior
        </h5>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-2">
            System Prompt
          </label>
          <textarea
            value={formData.system_prompt}
            onChange={(e) => handleChange('system_prompt', e.target.value)}
            onBlur={() => handleBlur('system_prompt')}
            rows={8}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 font-mono"
            placeholder="You are a helpful AI assistant..."
          />
          <p className="mt-1 text-xs text-slate-500">
            Define the bot's personality, expertise, and behavior
          </p>
        </div>
      </div>

      {/* Advanced Settings */}
      <div>
        <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Advanced Settings
        </h5>

        {/* Temperature */}
        <div className="mb-3">
          <label className="block text-xs font-medium text-slate-300 mb-2">
            Temperature: {formData.temperature?.toFixed(2) || '0.70'}
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.01"
            value={formData.temperature || 0.7}
            onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
            onMouseUp={() => handleBlur('temperature')}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>More Focused</span>
            <span>More Creative</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-2">
            Max Tokens (Optional)
          </label>
          <input
            type="number"
            min="1"
            max="100000"
            value={formData.max_tokens || ''}
            onChange={(e) =>
              handleChange('max_tokens', e.target.value ? parseInt(e.target.value) : undefined)
            }
            onBlur={() => handleBlur('max_tokens')}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            placeholder="Auto"
          />
          <p className="mt-1 text-xs text-slate-500">
            Maximum response length (leave empty for model default)
          </p>
        </div>
      </div>

      {/* Description */}
      <div>
        <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Documentation
        </h5>

        <div>
          <label className="block text-xs font-medium text-slate-300 mb-2">
            Description (Optional)
          </label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => handleChange('description', e.target.value || undefined)}
            onBlur={() => handleBlur('description')}
            rows={3}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            placeholder="Describe what this bot does..."
          />
        </div>
      </div>

      {/* Feature Toggles */}
      <div>
        <h5 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
          Features
        </h5>

        <div className="space-y-2">
          {/* Streaming */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.streaming_enabled !== false}
              onChange={(e) => handleChange('streaming_enabled', e.target.checked)}
              onBlur={() => handleBlur('streaming_enabled')}
              className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-2 focus:ring-blue-500/50"
            />
            <span className="text-sm text-slate-300">Enable Streaming Responses</span>
          </label>

          {/* Show Thinking */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.show_thinking || false}
              onChange={(e) => handleChange('show_thinking', e.target.checked)}
              onBlur={() => handleBlur('show_thinking')}
              className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-2 focus:ring-blue-500/50"
            />
            <span className="text-sm text-slate-300">Show Thinking Process</span>
          </label>

          {/* Memory */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.memory_enabled || false}
              onChange={(e) => handleChange('memory_enabled', e.target.checked)}
              onBlur={() => handleBlur('memory_enabled')}
              className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-2 focus:ring-blue-500/50"
            />
            <span className="text-sm text-slate-300">Enable Memory (Context Retention)</span>
          </label>

          {/* Web Search */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={formData.web_search_enabled !== false}
              onChange={(e) => handleChange('web_search_enabled', e.target.checked)}
              onBlur={() => handleBlur('web_search_enabled')}
              className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-2 focus:ring-blue-500/50"
            />
            <span className="text-sm text-slate-300">Enable Web Search (Real-time Information)</span>
          </label>
        </div>
      </div>
    </div>
  );
}
