/**
 * Model Selector Component
 *
 * Allows users to select which AI model to use for chat (OpenAI or Claude).
 */

"use client";

import React from "react";
import { AVAILABLE_MODELS, type AIModel } from "@/lib/apiKeyStorage";

type ModelSelectorProps = {
  value: AIModel;
  onChange: (model: AIModel) => void;
};

const ModelSelector: React.FC<ModelSelectorProps> = ({ value, onChange }) => {
  // Group models by provider
  const openaiModels = AVAILABLE_MODELS.filter((m) => m.provider === "openai");
  const claudeModels = AVAILABLE_MODELS.filter((m) => m.provider === "claude");
  const grokModels = AVAILABLE_MODELS.filter((m) => m.provider === "grok");

  const renderModel = (model: typeof AVAILABLE_MODELS[0]) => (
    <label
      key={model.value}
      className={`flex items-start gap-3 rounded-lg border p-4 cursor-pointer transition-all ${
        value === model.value
          ? "border-purple-500 bg-purple-500/10"
          : "border-slate-700 bg-slate-800/50 hover:border-slate-600"
      }`}
    >
      <input
        type="radio"
        name="model"
        value={model.value}
        checked={value === model.value}
        onChange={(e) => onChange(e.target.value as AIModel)}
        className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500"
      />
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-slate-100">{model.label}</span>

          {/* Provider Badge */}
          {model.provider === "openai" ? (
            <span className="rounded-full bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">
              OpenAI
            </span>
          ) : model.provider === "claude" ? (
            <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-xs text-orange-300">
              Claude
            </span>
          ) : (
            <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">
              Grok
            </span>
          )}

          {/* Recommended Badge */}
          {model.value === "gpt-5" && (
            <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-300">
              Recommended
            </span>
          )}

          {/* Latest Badge for GPT-5 models */}
          {model.value.startsWith("gpt-5") && (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
              Latest
            </span>
          )}

          {/* Latest Badge for Claude Sonnet 4.5 and Haiku 4.5 */}
          {(model.value === "claude-sonnet-4-5" || model.value === "claude-haiku-4-5") && (
            <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
              Latest
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-slate-400">{model.description}</p>
      </div>
    </label>
  );

  return (
    <div className="space-y-6">
      {/* OpenAI Models */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-300 flex items-center gap-2">
          <span className="h-1 w-1 rounded-full bg-blue-400"></span>
          OpenAI Models
        </h3>
        <div className="space-y-3">{openaiModels.map(renderModel)}</div>
      </div>

      {/* Claude Models */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-300 flex items-center gap-2">
          <span className="h-1 w-1 rounded-full bg-orange-400"></span>
          Claude (Anthropic) Models
        </h3>
        <div className="space-y-3">{claudeModels.map(renderModel)}</div>
      </div>

      {/* Grok Models */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-slate-300 flex items-center gap-2">
          <span className="h-1 w-1 rounded-full bg-purple-400"></span>
          Grok (xAI) Models
        </h3>
        <div className="space-y-3">{grokModels.map(renderModel)}</div>
      </div>
    </div>
  );
};

export default ModelSelector;
