/**
 * Model Dropdown Component
 *
 * Allows users to select which AI model to use for their messages.
 * Only shows models for providers where the user has configured API keys.
 */

"use client";

import React, { useState, useRef, useEffect } from "react";
import type { AIModel } from "@/lib/apiKeyStorage";
import { getAvailableModels } from "@/lib/availableModels";

type ModelDropdownProps = {
  selectedModel: AIModel;
  onModelChange: (model: AIModel) => void;
  disabled?: boolean;
  userTier?: "trial" | "pro" | "expired";
};

const ModelDropdown: React.FC<ModelDropdownProps> = ({
  selectedModel,
  onModelChange,
  disabled = false,
  userTier,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const availableModels = getAvailableModels(userTier);
  const selectedModelInfo = availableModels.find((m) => m.value === selectedModel);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  const handleModelSelect = (model: AIModel) => {
    onModelChange(model);
    setIsOpen(false);
  };

  // Group models by provider
  const openaiModels = availableModels.filter((m) => m.provider === "openai");
  const claudeModels = availableModels.filter((m) => m.provider === "claude");
  const grokModels = availableModels.filter((m) => m.provider === "grok");

  if (availableModels.length === 0) {
    return (
      <div className="text-xs text-slate-500">
        No models available. Add API keys in Settings.
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Dropdown Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-700 disabled:opacity-60 transition-colors"
        title="Select AI model"
      >
        {/* Provider Icon */}
        {selectedModelInfo?.provider === "openai" ? (
          <span className="flex h-4 w-4 items-center justify-center rounded bg-blue-500/20 text-blue-300 text-[10px] font-bold">
            O
          </span>
        ) : selectedModelInfo?.provider === "claude" ? (
          <span className="flex h-4 w-4 items-center justify-center rounded bg-orange-500/20 text-orange-300 text-[10px] font-bold">
            C
          </span>
        ) : (
          <span className="flex h-4 w-4 items-center justify-center rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">
            G
          </span>
        )}

        {/* Model Name */}
        <span className="font-medium">{selectedModelInfo?.label || selectedModel}</span>

        {/* Chevron */}
        <svg
          className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-80 rounded-lg border border-slate-700 bg-slate-900 shadow-xl z-50 max-h-96 overflow-y-auto">
          <div className="p-2">
            {/* OpenAI Models */}
            {openaiModels.length > 0 && (
              <div className="mb-3">
                <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  OpenAI Models
                </div>
                <div className="space-y-1">
                  {openaiModels.map((model) => (
                    <button
                      key={model.value}
                      onClick={() => handleModelSelect(model.value)}
                      className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                        selectedModel === model.value
                          ? "bg-blue-600/20 border border-blue-500/30"
                          : "hover:bg-slate-800 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-slate-100">
                          {model.label}
                        </span>
                        {model.value.startsWith("gpt-5") && (
                          <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] text-emerald-300">
                            Latest
                          </span>
                        )}
                        {model.value === "gpt-5.1" && (
                          <span className="rounded-full bg-purple-500/20 px-1.5 py-0.5 text-[9px] text-purple-300">
                            Recommended
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 leading-tight">
                        {model.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Claude Models */}
            {claudeModels.length > 0 && (
              <div className="mb-3">
                <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Claude Models
                </div>
                <div className="space-y-1">
                  {claudeModels.map((model) => (
                    <button
                      key={model.value}
                      onClick={() => handleModelSelect(model.value)}
                      className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                        selectedModel === model.value
                          ? "bg-orange-600/20 border border-orange-500/30"
                          : "hover:bg-slate-800 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-slate-100">
                          {model.label}
                        </span>
                        {(model.value === "claude-sonnet-4-5" || model.value === "claude-haiku-4-5") && (
                          <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] text-emerald-300">
                            Latest
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 leading-tight">
                        {model.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Grok Models */}
            {grokModels.length > 0 && (
              <div>
                <div className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Grok Models
                </div>
                <div className="space-y-1">
                  {grokModels.map((model) => (
                    <button
                      key={model.value}
                      onClick={() => handleModelSelect(model.value)}
                      className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                        selectedModel === model.value
                          ? "bg-purple-600/20 border border-purple-500/30"
                          : "hover:bg-slate-800 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-slate-100">
                          {model.label}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-400 leading-tight">
                        {model.description}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelDropdown;
