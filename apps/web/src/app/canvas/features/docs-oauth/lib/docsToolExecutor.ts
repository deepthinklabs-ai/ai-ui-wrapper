/**
 * Google Docs Tool Executor (Client-side)
 *
 * Executes Docs tool calls via API routes.
 * This is used by the client to execute tools.
 */

import type { DocsOperationResult, DocsPermissions } from '../types';

interface ToolCall {
  id: string;
  name: string;
  input: any;
}

interface ToolResult {
  toolCallId: string;
  result: string;
  isError: boolean;
}

/**
 * Execute Docs tool calls via API
 */
export async function executeDocsToolCalls(
  toolCalls: ToolCall[],
  userId: string,
  nodeId: string,
  permissions: DocsPermissions
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];

  for (const call of toolCalls) {
    try {
      const response = await fetch('/api/canvas/docs/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolName: call.name,
          params: call.input,
          userId,
          nodeId,
          permissions,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        results.push({
          toolCallId: call.id,
          result: JSON.stringify({ error: errorData.error || 'API request failed' }),
          isError: true,
        });
        continue;
      }

      const result: DocsOperationResult = await response.json();

      if (result.success) {
        results.push({
          toolCallId: call.id,
          result: JSON.stringify(result.data),
          isError: false,
        });
      } else {
        results.push({
          toolCallId: call.id,
          result: JSON.stringify({ error: result.error }),
          isError: true,
        });
      }
    } catch (error) {
      results.push({
        toolCallId: call.id,
        result: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
        }),
        isError: true,
      });
    }
  }

  return results;
}
