/**
 * Feature Toggles Settings Component
 *
 * Allows users to enable/disable chatbot features to customize their experience.
 */

"use client";

import React, { useState } from "react";
import {
  FEATURE_DEFINITIONS,
  FEATURE_CATEGORIES,
  type FeatureId,
  type FeatureCategory,
} from "@/types/features";
import { useFeatureToggles } from "@/hooks/useFeatureToggles";

type FeatureTogglesProps = {
  userId: string | null | undefined;
};

export default function FeatureToggles({ userId }: FeatureTogglesProps) {
  const { isFeatureEnabled, toggleFeature, resetToDefaults, loading, error } =
    useFeatureToggles(userId);

  const [resetting, setResetting] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const handleToggle = async (featureId: FeatureId) => {
    try {
      await toggleFeature(featureId);

      // Show saved message
      const featureName = FEATURE_DEFINITIONS[featureId].name;
      setSavedMessage(`${featureName} ${isFeatureEnabled(featureId) ? 'disabled' : 'enabled'}`);

      // Clear message after 3 seconds
      setTimeout(() => setSavedMessage(null), 3000);
    } catch (err) {
      console.error("Failed to toggle feature:", err);
    }
  };

  const handleResetToDefaults = async () => {
    if (
      !confirm(
        "Are you sure you want to reset all features to their default settings?"
      )
    ) {
      return;
    }

    setResetting(true);
    try {
      await resetToDefaults();
    } catch (err) {
      console.error("Failed to reset features:", err);
    } finally {
      setResetting(false);
    }
  };

  // Group features by category
  const featuresByCategory: Record<FeatureCategory, FeatureId[]> = {
    message_actions: [],
    thread_operations: [],
    input_enhancements: [],
    ai_controls: [],
    advanced_features: [],
  };

  Object.values(FEATURE_DEFINITIONS).forEach((feature) => {
    featuresByCategory[feature.category].push(feature.id);
  });

  if (loading && !userId) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-800 p-6">
        <p className="text-slate-400">Loading feature preferences...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">
            Customize Features
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Enable or disable chatbot features to customize your experience
          </p>
        </div>
        <button
          onClick={handleResetToDefaults}
          disabled={resetting || loading}
          className="rounded-md border border-slate-600 bg-slate-800 px-3 py-1.5 text-sm font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
        >
          {resetting ? "Resetting..." : "Reset to Defaults"}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {savedMessage && (
        <div className="rounded-md border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-400 flex items-center gap-2">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {savedMessage} successfully
        </div>
      )}

      {/* Feature Categories */}
      <div className="space-y-6">
        {(Object.keys(FEATURE_CATEGORIES) as FeatureCategory[]).map(
          (categoryKey) => {
            const category = FEATURE_CATEGORIES[categoryKey];
            const categoryFeatures = featuresByCategory[categoryKey];

            if (categoryFeatures.length === 0) return null;

            return (
              <div
                key={categoryKey}
                className="rounded-lg border border-slate-700 bg-slate-800 p-6"
              >
                <h3 className="mb-1 font-semibold text-slate-100">
                  {category.name}
                </h3>
                <p className="mb-4 text-sm text-slate-400">
                  {category.description}
                </p>

                <div className="space-y-3">
                  {categoryFeatures.map((featureId) => {
                    const feature = FEATURE_DEFINITIONS[featureId];
                    const enabled = isFeatureEnabled(featureId);

                    return (
                      <div
                        key={featureId}
                        className="flex items-start justify-between rounded-md border border-slate-700 bg-slate-900 p-4"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {feature.icon && (
                              <span className="text-lg">{feature.icon}</span>
                            )}
                            <h4 className="font-medium text-slate-100">
                              {feature.name}
                            </h4>
                            {feature.requiresPro && (
                              <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
                                Pro
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-slate-400">
                            {feature.description}
                          </p>
                        </div>

                        <button
                          onClick={() => handleToggle(featureId)}
                          disabled={loading}
                          className={`relative ml-4 inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50 ${
                            enabled ? "bg-blue-600" : "bg-slate-600"
                          }`}
                          role="switch"
                          aria-checked={enabled}
                        >
                          <span
                            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              enabled ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }
        )}
      </div>

      {/* Info Box */}
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
        <div className="flex gap-3">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-blue-300">
              Feature Preferences
            </h4>
            <p className="mt-1 text-sm text-blue-200/80">
              Your feature preferences are saved automatically and will persist
              across sessions. You can change them at any time.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
