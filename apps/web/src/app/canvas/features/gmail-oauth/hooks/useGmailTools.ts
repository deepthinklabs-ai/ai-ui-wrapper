/**
 * useGmailTools Hook
 *
 * Provides Gmail tool execution capability for Genesis Bot nodes.
 * Handles tool calls from AI and executes them via the Gmail API.
 */

'use client';

import { useCallback } from 'react';
import { useAuthSession } from '@/hooks/useAuthSession';
import type { GmailOAuthConfig, GmailOperationResult } from '../types';
import { getEnabledGmailTools, toClaudeToolFormat } from '../lib/gmailTools';

interface UseGmailToolsResult {
  // Get tools for AI
  getToolsForClaude: () => ReturnType<typeof toClaudeToolFormat>;

  // Execute a tool call
  executeTool: (
    toolName: string,
    parameters: Record<string, unknown>,
    nodeId: string
  ) => Promise<GmailOperationResult>;

  // Check if tool is available
  isToolAvailable: (toolName: string) => boolean;
}

export function useGmailTools(config: GmailOAuthConfig | undefined): UseGmailToolsResult {
  const { user } = useAuthSession();

  /**
   * Get enabled Gmail tools formatted for Claude API
   */
  const getToolsForClaude = useCallback(() => {
    if (!config?.enabled || !config.connectionId) {
      return [];
    }

    const enabledTools = getEnabledGmailTools(config.permissions);
    return toClaudeToolFormat(enabledTools);
  }, [config]);

  /**
   * Check if a specific tool is available
   */
  const isToolAvailable = useCallback((toolName: string): boolean => {
    if (!config?.enabled || !config.connectionId) {
      return false;
    }

    const enabledTools = getEnabledGmailTools(config.permissions);
    return enabledTools.some(t => t.name === toolName);
  }, [config]);

  /**
   * Execute a Gmail tool call
   */
  const executeTool = useCallback(async (
    toolName: string,
    parameters: Record<string, unknown>,
    nodeId: string
  ): Promise<GmailOperationResult> => {
    if (!user?.id) {
      return {
        success: false,
        error: 'User not authenticated',
      };
    }

    if (!config?.enabled || !config.connectionId) {
      return {
        success: false,
        error: 'Gmail integration not enabled for this bot',
      };
    }

    if (!isToolAvailable(toolName)) {
      return {
        success: false,
        error: `Tool "${toolName}" is not available with current permissions`,
      };
    }

    try {
      const response = await fetch('/api/canvas/gmail/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          nodeId,
          toolName,
          parameters,
          permissions: config.permissions,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: result.error || 'Failed to execute Gmail operation',
        };
      }

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      console.error('[useGmailTools] Error executing tool:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }, [user?.id, config, isToolAvailable]);

  return {
    getToolsForClaude,
    executeTool,
    isToolAvailable,
  };
}
