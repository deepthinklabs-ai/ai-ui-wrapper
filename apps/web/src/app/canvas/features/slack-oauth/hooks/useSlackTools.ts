/**
 * useSlackTools Hook
 *
 * Hook for using Slack tools in a Genesis Bot node.
 */

'use client';

import { useCallback, useState } from 'react';
import type { SlackOAuthConfig, SlackPermissions, SlackOperationResult } from '../types';
import { getEnabledSlackTools, toClaudeToolFormat } from '../lib/slackTools';

interface UseSlackToolsOptions {
  config: SlackOAuthConfig;
  nodeId: string;
}

interface UseSlackToolsResult {
  // Tool definitions
  tools: any[];
  enabledTools: string[];

  // Execute a tool
  executeTool: (toolName: string, params: any) => Promise<SlackOperationResult>;

  // Loading state
  isExecuting: boolean;
  lastError: string | null;
}

export function useSlackTools({ config, nodeId }: UseSlackToolsOptions): UseSlackToolsResult {
  const [isExecuting, setIsExecuting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Get enabled tools based on permissions
  const enabledToolDefinitions = getEnabledSlackTools(config.permissions);
  const tools = toClaudeToolFormat(enabledToolDefinitions);
  const enabledTools = enabledToolDefinitions.map((t) => t.name);

  // Execute a tool via API
  const executeTool = useCallback(
    async (toolName: string, params: any): Promise<SlackOperationResult> => {
      if (!config.enabled || !config.connectionId) {
        return {
          success: false,
          error: 'Slack integration is not enabled or connected',
        };
      }

      // Check if tool is enabled
      if (!enabledTools.includes(toolName)) {
        return {
          success: false,
          error: `Tool ${toolName} is not enabled with current permissions`,
        };
      }

      setIsExecuting(true);
      setLastError(null);

      try {
        const response = await fetch('/api/canvas/slack/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            toolName,
            params,
            nodeId,
            connectionId: config.connectionId,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to execute Slack tool');
        }

        const result = await response.json();
        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        setLastError(errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setIsExecuting(false);
      }
    },
    [config.enabled, config.connectionId, nodeId, enabledTools]
  );

  return {
    tools,
    enabledTools,
    executeTool,
    isExecuting,
    lastError,
  };
}
