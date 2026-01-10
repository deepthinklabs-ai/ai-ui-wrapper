/**
 * useSSMConfig Hook
 *
 * Manages State-Space Model (SSM) configuration state.
 * Handles rules-based configuration with:
 * - Auto-save with debouncing
 * - Validation integration
 * - Rule generation state
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type {
  SSMAgentNodeConfig,
  SSMRulesConfig,
  SSMResponseTemplate,
  SSMEventSourceType,
} from '../../../types/ssm';
import { validateSSMConfig, applySSMDefaults, type ValidationResult } from '../lib/ssmValidation';
import { DEFAULT_SSM_CONFIG, DEFAULT_RESPONSE_TEMPLATES } from '../lib/ssmDefaults';

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
   * Update the event source type
   */
  updateEventSource: (type: SSMEventSourceType) => void;
  /**
   * Update rules configuration
   */
  updateRules: (rules: SSMRulesConfig) => void;
  /**
   * Update response templates
   */
  updateTemplates: (templates: SSMResponseTemplate[]) => void;
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
   * Reset to initial config
   */
  reset: () => void;
  /**
   * Check if rules have been configured
   */
  hasRules: boolean;
  /**
   * Count of enabled rules
   */
  enabledRulesCount: number;
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

  // Check if rules are configured
  const hasRules = useMemo(() => {
    const rules = config.rules;
    return (
      (rules?.keywords?.length || 0) > 0 ||
      (rules?.patterns?.length || 0) > 0 ||
      (rules?.conditions?.length || 0) > 0
    );
  }, [config.rules]);

  // Count enabled rules
  const enabledRulesCount = useMemo(() => {
    const rules = config.rules;
    return (
      (rules?.keywords?.filter(r => r.enabled)?.length || 0) +
      (rules?.patterns?.filter(r => r.enabled)?.length || 0) +
      (rules?.conditions?.filter(r => r.enabled)?.length || 0)
    );
  }, [config.rules]);

  // Update a single field
  const updateField = useCallback(<K extends keyof SSMAgentNodeConfig>(
    field: K,
    value: SSMAgentNodeConfig[K]
  ) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  }, []);

  // Update event source
  const updateEventSource = useCallback((type: SSMEventSourceType) => {
    setConfig(prev => ({
      ...prev,
      event_source_type: type,
      // Clear polling/webhook specific fields when switching
      ...(type !== 'polling' ? { polling_source: undefined, polling_interval_seconds: undefined } : {}),
      ...(type !== 'webhook' ? { webhook_secret: undefined } : {}),
    }));
    setIsDirty(true);
  }, []);

  // Update rules
  const updateRules = useCallback((rules: SSMRulesConfig) => {
    setConfig(prev => ({ ...prev, rules }));
    setIsDirty(true);
  }, []);

  // Update templates
  const updateTemplates = useCallback((templates: SSMResponseTemplate[]) => {
    setConfig(prev => ({ ...prev, response_templates: templates }));
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
    updateEventSource,
    updateRules,
    updateTemplates,
    save,
    isSaving,
    isDirty,
    errors: validation.errors,
    warnings: validation.warnings,
    validation,
    reset,
    hasRules,
    enabledRulesCount,
  };
}
