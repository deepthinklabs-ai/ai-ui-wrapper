/**
 * useSSMConfig Hook
 *
 * Manages SSM Agent configuration state.
 * Provides:
 * - Local state management
 * - Validation integration
 * - Provider-aware model selection
 * - Debounced save callbacks
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { SSMAgentNodeConfig, SSMModelProvider } from '../../../types/ssm';
import { validateSSMConfig, applySSMDefaults, type ValidationResult } from '../lib/ssmValidation';
import { DEFAULT_SSM_CONFIG, getModelsForProvider, getDefaultModelForProvider } from '../lib/ssmDefaults';

// ============================================================================
// TYPES
// ============================================================================

interface UseSSMConfigProps {
  /**
   * Initial configuration from the node
   */
  initialConfig: Partial<SSMAgentNodeConfig>;
  /**
   * Callback to persist changes
   */
  onSave: (config: SSMAgentNodeConfig) => Promise<boolean>;
  /**
   * Debounce delay for auto-save (ms)
   * Set to 0 to disable auto-save
   */
  autoSaveDelay?: number;
}

interface UseSSMConfigReturn {
  /**
   * Current configuration state
   */
  config: SSMAgentNodeConfig;
  /**
   * Update a single field
   */
  updateField: <K extends keyof SSMAgentNodeConfig>(field: K, value: SSMAgentNodeConfig[K]) => void;
  /**
   * Update the provider and reset model to first available
   */
  updateProvider: (provider: SSMModelProvider) => void;
  /**
   * Manually trigger save
   */
  save: () => Promise<boolean>;
  /**
   * Whether a save operation is in progress
   */
  isSaving: boolean;
  /**
   * Whether there are unsaved changes
   */
  isDirty: boolean;
  /**
   * Validation errors
   */
  errors: string[];
  /**
   * Validation warnings
   */
  warnings: string[];
  /**
   * Full validation result
   */
  validation: ValidationResult;
  /**
   * Available models for current provider
   */
  availableModels: string[];
  /**
   * Reset to initial config
   */
  reset: () => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useSSMConfig({
  initialConfig,
  onSave,
  autoSaveDelay = 500,
}: UseSSMConfigProps): UseSSMConfigReturn {
  // Apply defaults to initial config
  const normalizedInitial = useMemo(
    () => applySSMDefaults({ ...DEFAULT_SSM_CONFIG, ...initialConfig }),
    // Only re-compute on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // State
  const [config, setConfig] = useState<SSMAgentNodeConfig>(normalizedInitial);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Refs for debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedConfigRef = useRef<string>(JSON.stringify(normalizedInitial));

  // Validation
  const validation = useMemo(() => validateSSMConfig(config), [config]);

  // Available models for current provider
  const availableModels = useMemo(
    () => getModelsForProvider(config.model_provider),
    [config.model_provider]
  );

  // Update a single field
  const updateField = useCallback(<K extends keyof SSMAgentNodeConfig>(
    field: K,
    value: SSMAgentNodeConfig[K]
  ) => {
    setConfig(prev => {
      const newConfig = { ...prev, [field]: value };
      return newConfig;
    });
    setIsDirty(true);
  }, []);

  // Update provider and reset model
  const updateProvider = useCallback((provider: SSMModelProvider) => {
    const defaultModel = getDefaultModelForProvider(provider);
    setConfig(prev => ({
      ...prev,
      model_provider: provider,
      model_name: defaultModel,
      // Reset endpoint to default when switching providers
      model_endpoint: provider === 'ollama'
        ? 'http://localhost:11434'
        : provider === 'vllm'
          ? 'http://localhost:8000'
          : undefined,
    }));
    setIsDirty(true);
  }, []);

  // Manual save
  const save = useCallback(async (): Promise<boolean> => {
    // Clear any pending auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }

    // Validate before save
    const result = validateSSMConfig(config);
    if (!result.isValid) {
      return false;
    }

    setIsSaving(true);
    try {
      const success = await onSave(config);
      if (success) {
        lastSavedConfigRef.current = JSON.stringify(config);
        setIsDirty(false);
      }
      return success;
    } finally {
      setIsSaving(false);
    }
  }, [config, onSave]);

  // Reset to initial config
  const reset = useCallback(() => {
    setConfig(normalizedInitial);
    setIsDirty(false);
  }, [normalizedInitial]);

  // Auto-save on config changes (debounced)
  useEffect(() => {
    if (!isDirty || autoSaveDelay === 0) {
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for auto-save
    saveTimeoutRef.current = setTimeout(() => {
      // Only auto-save if valid and different from last saved
      const currentJson = JSON.stringify(config);
      if (currentJson !== lastSavedConfigRef.current) {
        const result = validateSSMConfig(config);
        if (result.isValid) {
          onSave(config).then(success => {
            if (success) {
              lastSavedConfigRef.current = currentJson;
              setIsDirty(false);
            }
          });
        }
      }
    }, autoSaveDelay);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [config, isDirty, autoSaveDelay, onSave]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    config,
    updateField,
    updateProvider,
    save,
    isSaving,
    isDirty,
    errors: validation.errors,
    warnings: validation.warnings,
    validation,
    availableModels,
    reset,
  };
}
