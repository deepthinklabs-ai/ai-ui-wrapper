/**
 * Feature Toggles Hook
 *
 * Manages user preferences for which chatbot features are enabled/disabled.
 * Features are stored in Supabase and cached locally for performance.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  type FeatureId,
  type UserFeaturePreferences,
  FEATURE_DEFINITIONS,
} from "@/types/features";

type UseFeatureTogglesResult = {
  // Check if a feature is enabled
  isFeatureEnabled: (featureId: FeatureId) => boolean;

  // Toggle a specific feature on/off
  toggleFeature: (featureId: FeatureId) => Promise<void>;

  // Set a specific feature's state
  setFeature: (featureId: FeatureId, enabled: boolean) => Promise<void>;

  // Reset all features to defaults
  resetToDefaults: () => Promise<void>;

  // Get all feature states
  features: Record<FeatureId, boolean>;

  // Loading and error states
  loading: boolean;
  error: string | null;
};

export function useFeatureToggles(userId: string | null | undefined): UseFeatureTogglesResult {
  const [features, setFeatures] = useState<Record<FeatureId, boolean>>(() => {
    // Initialize with defaults
    const defaults: Record<string, boolean> = {};
    Object.values(FEATURE_DEFINITIONS).forEach((def) => {
      defaults[def.id] = def.defaultEnabled;
    });
    return defaults as Record<FeatureId, boolean>;
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load user's feature preferences from database
  useEffect(() => {
    if (!userId) {
      // If no user, use defaults
      const defaults: Record<string, boolean> = {};
      Object.values(FEATURE_DEFINITIONS).forEach((def) => {
        defaults[def.id] = def.defaultEnabled;
      });
      setFeatures(defaults as Record<FeatureId, boolean>);
      return;
    }

    const loadFeaturePreferences = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from("user_feature_preferences")
          .select("features")
          .eq("user_id", userId)
          .single();

        if (fetchError) {
          if (fetchError.code === "PGRST116") {
            // No preferences found, create with defaults
            const defaults: Record<string, boolean> = {};
            Object.values(FEATURE_DEFINITIONS).forEach((def) => {
              defaults[def.id] = def.defaultEnabled;
            });

            const { error: insertError } = await supabase
              .from("user_feature_preferences")
              .insert({
                user_id: userId,
                features: defaults,
              });

            if (insertError) throw insertError;

            setFeatures(defaults as Record<FeatureId, boolean>);
          } else {
            throw fetchError;
          }
        } else if (data && data.features) {
          // Merge with defaults to ensure new features are included
          const defaults: Record<string, boolean> = {};
          Object.values(FEATURE_DEFINITIONS).forEach((def) => {
            defaults[def.id] = def.defaultEnabled;
          });

          const merged = { ...defaults, ...data.features };
          setFeatures(merged as Record<FeatureId, boolean>);
        }
      } catch (err: any) {
        console.error("Error loading feature preferences:", err);
        setError(err.message || "Failed to load feature preferences");
      } finally {
        setLoading(false);
      }
    };

    void loadFeaturePreferences();
  }, [userId]);

  // Check if a feature is enabled
  const isFeatureEnabled = useCallback(
    (featureId: FeatureId): boolean => {
      return features[featureId] ?? FEATURE_DEFINITIONS[featureId]?.defaultEnabled ?? false;
    },
    [features]
  );

  // Update features in database
  const updateFeatures = async (newFeatures: Record<FeatureId, boolean>) => {
    if (!userId) {
      setError("Cannot save feature preferences: user not logged in");
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from("user_feature_preferences")
        .update({
          features: newFeatures,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (updateError) throw updateError;

      setFeatures(newFeatures);
    } catch (err: any) {
      console.error("Error updating feature preferences:", err);
      setError(err.message || "Failed to update feature preferences");
      throw err;
    }
  };

  // Toggle a specific feature
  const toggleFeature = async (featureId: FeatureId) => {
    const newFeatures = {
      ...features,
      [featureId]: !features[featureId],
    };
    await updateFeatures(newFeatures);
  };

  // Set a specific feature's state
  const setFeature = async (featureId: FeatureId, enabled: boolean) => {
    const newFeatures = {
      ...features,
      [featureId]: enabled,
    };
    await updateFeatures(newFeatures);
  };

  // Reset all features to defaults
  const resetToDefaults = async () => {
    const defaults: Record<string, boolean> = {};
    Object.values(FEATURE_DEFINITIONS).forEach((def) => {
      defaults[def.id] = def.defaultEnabled;
    });
    await updateFeatures(defaults as Record<FeatureId, boolean>);
  };

  return {
    isFeatureEnabled,
    toggleFeature,
    setFeature,
    resetToDefaults,
    features,
    loading,
    error,
  };
}
