"use client";

/**
 * ChatbotSettingsPanel Component
 *
 * A non-blocking side panel for editing chatbot settings.
 * Slides in from the right side without blocking the main UI.
 */

import React, { useState, useEffect } from "react";
import type { Chatbot } from "@/types/chatbot";
import type { ChatbotFileConfig, ChatbotFileProvider } from "@/types/chatbotFile";
import type { FeatureId, FeatureCategory } from "@/types/features";
import { FEATURE_DEFINITIONS, FEATURE_CATEGORIES } from "@/types/features";
import type { AIModel } from "@/lib/apiKeyStorage";

type ChatbotSettingsPanelProps = {
  /** The chatbot being edited */
  chatbot: Chatbot;
  /** Whether the panel is open */
  isOpen: boolean;
  /** Called when the panel should close */
  onClose: () => void;
  /** Called when saving changes */
  onSave: (config: ChatbotFileConfig) => Promise<void>;
  /** Called when draft config changes (for real-time preview) */
  onDraftChange?: (config: ChatbotFileConfig) => void;
};

// Model options by provider
const MODEL_OPTIONS: Record<ChatbotFileProvider, { value: AIModel; label: string }[]> = {
  openai: [
    { value: "gpt-5.1", label: "GPT-5.1" },
    { value: "gpt-5-mini", label: "GPT-5 Mini" },
    { value: "gpt-5-nano", label: "GPT-5 Nano" },
    { value: "gpt-4o", label: "GPT-4o" },
    { value: "gpt-4o-mini", label: "GPT-4o Mini" },
    { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
    { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" },
  ],
  claude: [
    { value: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
    { value: "claude-sonnet-4", label: "Claude Sonnet 4" },
    { value: "claude-opus-4-1", label: "Claude Opus 4.1" },
    { value: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    { value: "claude-haiku-3-5", label: "Claude Haiku 3.5" },
  ],
  grok: [
    { value: "grok-4-fast-reasoning", label: "Grok 4 Fast Reasoning" },
    { value: "grok-4-fast-non-reasoning", label: "Grok 4 Fast Non-Reasoning" },
    { value: "grok-4-1-fast-reasoning", label: "Grok 4.1 Fast Reasoning" },
    { value: "grok-4-1-fast-non-reasoning", label: "Grok 4.1 Fast Non-Reasoning" },
    { value: "grok-code-fast-1", label: "Grok Code Fast 1" },
  ],
  gemini: [
    { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
    { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
  ],
};

const PROVIDER_LABELS: Record<ChatbotFileProvider, string> = {
  openai: "OpenAI",
  claude: "Claude",
  grok: "Grok",
  gemini: "Gemini",
};

// Feature dependencies - child features that require a parent to be enabled
// Key: child feature, Value: parent feature it depends on
const FEATURE_DEPENDENCIES: Partial<Record<FeatureId, FeatureId>> = {
  context_panel: 'text_selection_popup', // Context Panel requires Text Selection Actions
};

// Features that have children nested under them (other FeatureIds)
const NESTED_FEATURES: Partial<Record<FeatureId, FeatureId[]>> = {
  text_selection_popup: ['context_panel'],
};

// Features that have custom sub-options (not regular features, but config fields)
// step_by_step_mode has two sub-options stored as separate config fields
const FEATURES_WITH_CUSTOM_CHILDREN: FeatureId[] = ['step_by_step_mode'];

// Group features by category
const getFeaturesByCategory = (): Record<FeatureCategory, FeatureId[]> => {
  const grouped: Record<FeatureCategory, FeatureId[]> = {
    message_actions: [],
    thread_operations: [],
    input_enhancements: [],
    ai_controls: [],
    advanced_features: [],
  };

  Object.values(FEATURE_DEFINITIONS).forEach((feature) => {
    // Skip features that are nested under another feature (they'll be rendered there)
    if (FEATURE_DEPENDENCIES[feature.id]) return;
    grouped[feature.category].push(feature.id);
  });

  return grouped;
};

export function ChatbotSettingsPanel({
  chatbot,
  isOpen,
  onClose,
  onSave,
  onDraftChange,
}: ChatbotSettingsPanelProps) {
  // Draft state for editing
  const [draftConfig, setDraftConfig] = useState<ChatbotFileConfig>(chatbot.config);
  const [isSaving, setIsSaving] = useState(false);

  // Reset draft when chatbot changes or panel opens
  useEffect(() => {
    if (isOpen) {
      console.log('[ChatbotSettingsPanel] Opening panel for chatbot:', chatbot.name, chatbot.id);
      console.log('[ChatbotSettingsPanel] Current config:', chatbot.config);
      setDraftConfig(chatbot.config);
    }
  }, [isOpen, chatbot.config, chatbot.name, chatbot.id]);

  // Notify parent of draft changes for real-time preview
  useEffect(() => {
    if (isOpen && onDraftChange) {
      onDraftChange(draftConfig);
    }
  }, [draftConfig, isOpen, onDraftChange]);

  const handleProviderChange = (provider: ChatbotFileProvider) => {
    const models = MODEL_OPTIONS[provider];
    const firstModel = models[0]?.value || "gpt-4o";
    setDraftConfig((prev) => ({
      ...prev,
      model: {
        ...prev.model,
        provider,
        model_name: firstModel,
      },
    }));
  };

  const handleModelChange = (modelName: AIModel) => {
    setDraftConfig((prev) => ({
      ...prev,
      model: {
        ...prev.model,
        model_name: modelName,
      },
    }));
  };

  const handleSystemPromptChange = (systemPrompt: string) => {
    setDraftConfig((prev) => ({
      ...prev,
      system_prompt: systemPrompt,
    }));
  };

  const handleFeatureToggle = (featureId: FeatureId, enabled: boolean) => {
    setDraftConfig((prev) => {
      const newFeatures = {
        ...prev.features,
        [featureId]: enabled,
      };

      // Auto-uncheck parent when child is unchecked (if child is the only one)
      // When context_panel is unchecked, also uncheck text_selection_popup
      if (featureId === 'context_panel' && !enabled) {
        newFeatures['text_selection_popup'] = false;
      }

      return {
        ...prev,
        features: newFeatures,
      };
    });
  };

  const handleVoiceIdChange = (voiceId: string) => {
    setDraftConfig((prev) => ({
      ...prev,
      voice_id: voiceId || undefined,
    }));
  };

  const handleStepByStepChange = (field: "step_by_step_with_explanation" | "step_by_step_no_explanation", enabled: boolean) => {
    setDraftConfig((prev) => {
      const newConfig = {
        ...prev,
        [field]: enabled,
      };

      // Auto-uncheck step_by_step_mode when both sub-options are unchecked
      const withExplanation = field === "step_by_step_with_explanation" ? enabled : prev.step_by_step_with_explanation;
      const noExplanation = field === "step_by_step_no_explanation" ? enabled : prev.step_by_step_no_explanation;

      if (!withExplanation && !noExplanation) {
        newConfig.features = {
          ...prev.features,
          step_by_step_mode: false,
        };
      }

      return newConfig;
    });
  };

  const handleSave = async () => {
    console.log('[ChatbotSettingsPanel] Saving config for chatbot:', chatbot.name);
    console.log('[ChatbotSettingsPanel] Draft config to save:', draftConfig);
    setIsSaving(true);
    try {
      await onSave(draftConfig);
      console.log('[ChatbotSettingsPanel] Save successful');
      onClose();
    } catch (error) {
      console.error("[ChatbotSettingsPanel] Failed to save chatbot settings:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    console.log('[ChatbotSettingsPanel] Canceling edit for chatbot:', chatbot.name);
    setDraftConfig(chatbot.config);
    onClose();
  };

  if (!isOpen) return null;

  const featuresByCategory = getFeaturesByCategory();
  const currentProvider = draftConfig.model?.provider || "openai";
  const currentModel = draftConfig.model?.model_name || "gpt-4o";

  return (
    <div className="fixed right-0 top-0 h-screen w-96 bg-slate-900 border-l border-slate-700 shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-3 bg-slate-900 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-cyan-500" />
          <h2 className="text-sm font-semibold text-slate-100 truncate">
            Edit {chatbot.name}.chatbot
          </h2>
        </div>
        <button
          onClick={handleCancel}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          title="Close panel"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* Model Section */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Model</h3>

          {/* Provider */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Provider</label>
            <select
              value={currentProvider}
              onChange={(e) => handleProviderChange(e.target.value as ChatbotFileProvider)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {(Object.keys(MODEL_OPTIONS) as ChatbotFileProvider[]).map((provider) => (
                <option key={provider} value={provider}>
                  {PROVIDER_LABELS[provider]}
                </option>
              ))}
            </select>
          </div>

          {/* Model */}
          <div>
            <label className="block text-xs text-slate-500 mb-1">Model</label>
            <select
              value={currentModel}
              onChange={(e) => handleModelChange(e.target.value as AIModel)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              {MODEL_OPTIONS[currentProvider].map((model) => (
                <option key={model.value} value={model.value}>
                  {model.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* System Prompt Section */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">System Prompt</h3>
          <textarea
            value={draftConfig.system_prompt || ""}
            onChange={(e) => handleSystemPromptChange(e.target.value)}
            placeholder="Enter custom instructions for this chatbot..."
            rows={4}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-y"
          />
        </div>

        {/* Features Section */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Features</h3>

          {(Object.keys(FEATURE_CATEGORIES) as FeatureCategory[]).map((category) => {
            const features = featuresByCategory[category];
            if (features.length === 0) return null;

            return (
              <div key={category} className="space-y-2">
                <h4 className="text-xs font-medium text-slate-500">
                  {FEATURE_CATEGORIES[category].name}
                </h4>
                <div className="space-y-1">
                  {features.map((featureId) => {
                    const feature = FEATURE_DEFINITIONS[featureId];
                    const isEnabled = draftConfig.features?.[featureId] ?? feature.defaultEnabled;
                    const nestedFeatures = NESTED_FEATURES[featureId] || [];

                    return (
                      <div key={featureId}>
                        <label
                          className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-slate-800/50 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isEnabled}
                            onChange={(e) => handleFeatureToggle(featureId, e.target.checked)}
                            className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-slate-200 truncate">
                              {feature.icon && <span className="mr-1.5">{feature.icon}</span>}
                              {feature.name}
                            </div>
                          </div>
                        </label>

                        {/* Render nested/dependent features */}
                        {nestedFeatures.length > 0 && (
                          <div className="ml-6 mt-1 space-y-1 border-l-2 border-slate-700 pl-3">
                            {nestedFeatures.map((nestedId) => {
                              const nestedFeature = FEATURE_DEFINITIONS[nestedId];
                              const nestedEnabled = draftConfig.features?.[nestedId] ?? nestedFeature.defaultEnabled;
                              const isParentDisabled = !isEnabled;

                              return (
                                <label
                                  key={nestedId}
                                  className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${
                                    isParentDisabled
                                      ? "opacity-50 cursor-not-allowed"
                                      : "hover:bg-slate-800/50 cursor-pointer"
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={nestedEnabled && !isParentDisabled}
                                    disabled={isParentDisabled}
                                    onChange={(e) => handleFeatureToggle(nestedId, e.target.checked)}
                                    className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <div className={`text-sm truncate ${isParentDisabled ? "text-slate-500" : "text-slate-200"}`}>
                                      {nestedFeature.icon && <span className="mr-1.5">{nestedFeature.icon}</span>}
                                      {nestedFeature.name}
                                    </div>
                                    {isParentDisabled && (
                                      <div className="text-xs text-slate-500 mt-0.5">
                                        Requires {feature.name}
                                      </div>
                                    )}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}

                        {/* Special handling for step_by_step_mode - render sub-options */}
                        {featureId === 'step_by_step_mode' && (
                          <div className="ml-6 mt-1 space-y-1 border-l-2 border-slate-700 pl-3">
                            <label
                              className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${
                                !isEnabled
                                  ? "opacity-50 cursor-not-allowed"
                                  : "hover:bg-slate-800/50 cursor-pointer"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={(draftConfig.step_by_step_with_explanation ?? false) && isEnabled}
                                disabled={!isEnabled}
                                onChange={(e) => handleStepByStepChange("step_by_step_with_explanation", e.target.checked)}
                                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm truncate ${!isEnabled ? "text-slate-500" : "text-slate-200"}`}>
                                  With Explanation
                                </div>
                                {!isEnabled && (
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    Requires {feature.name}
                                  </div>
                                )}
                              </div>
                            </label>
                            <label
                              className={`flex items-center gap-3 rounded-md px-2 py-1.5 ${
                                !isEnabled
                                  ? "opacity-50 cursor-not-allowed"
                                  : "hover:bg-slate-800/50 cursor-pointer"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={(draftConfig.step_by_step_no_explanation ?? false) && isEnabled}
                                disabled={!isEnabled}
                                onChange={(e) => handleStepByStepChange("step_by_step_no_explanation", e.target.checked)}
                                className="h-4 w-4 rounded border-slate-600 bg-slate-800 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                              />
                              <div className="flex-1 min-w-0">
                                <div className={`text-sm truncate ${!isEnabled ? "text-slate-500" : "text-slate-200"}`}>
                                  Without Explanation
                                </div>
                                {!isEnabled && (
                                  <div className="text-xs text-slate-500 mt-0.5">
                                    Requires {feature.name}
                                  </div>
                                )}
                              </div>
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Voice Section */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Voice</h3>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Voice ID</label>
            <input
              type="text"
              value={draftConfig.voice_id || ""}
              onChange={(e) => handleVoiceIdChange(e.target.value)}
              placeholder="Enter voice ID for TTS..."
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
        </div>

      </div>

      {/* Footer */}
      <div className="border-t border-slate-700 bg-slate-900 px-4 py-3 flex gap-3 shrink-0">
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="flex-1 rounded-md border border-slate-600 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 rounded-md bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
