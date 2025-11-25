/**
 * Google Sheets Tools Hook
 *
 * Provides Sheets tools for AI conversations.
 */

'use client';

import { useMemo } from 'react';
import type { SheetsOAuthConfig } from '../types';
import { sheetsTools, getEnabledSheetsTools, toClaudeToolFormat } from '../lib/sheetsTools';
import { generateSheetsSystemPrompt } from '../lib/sheetsToolExecutor';

interface UseSheetsToolsOptions {
  config: SheetsOAuthConfig;
}

export function useSheetsTools({ config }: UseSheetsToolsOptions) {
  // Get enabled tools based on permissions
  const enabledTools = useMemo(() => {
    if (!config.enabled) return [];
    return getEnabledSheetsTools(config.permissions);
  }, [config.enabled, config.permissions]);

  // Convert to Claude format
  const claudeTools = useMemo(() => {
    return toClaudeToolFormat(enabledTools);
  }, [enabledTools]);

  // Generate system prompt addition
  const systemPromptAddition = useMemo(() => {
    if (!config.enabled) return '';
    return generateSheetsSystemPrompt(config);
  }, [config]);

  // Check if specific tools are available
  const canRead = config.enabled && config.permissions.canRead;
  const canWrite = config.enabled && config.permissions.canWrite;
  const canCreate = config.enabled && config.permissions.canCreate;

  return {
    tools: enabledTools,
    claudeTools,
    systemPromptAddition,
    isEnabled: config.enabled,
    toolCount: enabledTools.length,
    canRead,
    canWrite,
    canCreate,
  };
}
