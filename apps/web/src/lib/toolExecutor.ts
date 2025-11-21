/**
 * Tool Executor
 *
 * Handles execution of MCP tool calls from LLM responses.
 * Manages the tool calling loop and result formatting.
 */

import { mcpClientManager, type MCPTool } from "./mcpClient";
import { findToolServer, formatToolResultForDisplay } from "./mcpToolFormatter";
import type { ToolCall, ToolResult } from "@/types/chat";

/**
 * Execute a single tool call
 */
export async function executeToolCall(
  toolCall: ToolCall,
  availableTools: Array<MCPTool & { serverId: string; serverName: string }>
): Promise<ToolResult> {
  try {
    // Find which server provides this tool
    const serverInfo = findToolServer(toolCall.name, availableTools);

    if (!serverInfo) {
      return {
        toolCallId: toolCall.id,
        toolName: toolCall.name,
        result: `Tool "${toolCall.name}" not found in any connected MCP server`,
        isError: true,
      };
    }

    console.log(
      `[Tool Executor] Calling tool "${toolCall.name}" on server "${serverInfo.serverName}"`
    );
    console.log(`[Tool Executor] Input:`, toolCall.input);

    // Execute the tool
    const result = await mcpClientManager.callTool(
      serverInfo.serverId,
      toolCall.name,
      toolCall.input
    );

    console.log(`[Tool Executor] Result:`, result);

    // Format result for display
    const formattedResult = formatToolResultForDisplay(toolCall.name, result);

    return {
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      result: formattedResult,
      isError: false,
    };
  } catch (error) {
    console.error(`[Tool Executor] Error executing tool "${toolCall.name}":`, error);

    return {
      toolCallId: toolCall.id,
      toolName: toolCall.name,
      result: error instanceof Error ? error.message : String(error),
      isError: true,
    };
  }
}

/**
 * Execute multiple tool calls in parallel
 */
export async function executeToolCalls(
  toolCalls: ToolCall[],
  availableTools: Array<MCPTool & { serverId: string; serverName: string }>
): Promise<ToolResult[]> {
  console.log(`[Tool Executor] Executing ${toolCalls.length} tool calls...`);

  // Execute all tools in parallel
  const resultPromises = toolCalls.map(toolCall =>
    executeToolCall(toolCall, availableTools)
  );

  const results = await Promise.all(resultPromises);

  console.log(`[Tool Executor] Completed ${results.length} tool calls`);

  return results;
}

/**
 * Check if any tool calls failed
 */
export function hasToolErrors(results: ToolResult[]): boolean {
  return results.some(r => r.isError);
}

/**
 * Get summary of tool execution
 */
export function getToolExecutionSummary(results: ToolResult[]): string {
  const total = results.length;
  const errors = results.filter(r => r.isError).length;
  const success = total - errors;

  if (errors === 0) {
    return `Successfully executed ${total} tool${total > 1 ? "s" : ""}`;
  } else if (success === 0) {
    return `Failed to execute ${total} tool${total > 1 ? "s" : ""}`;
  } else {
    return `Executed ${success}/${total} tools successfully (${errors} failed)`;
  }
}
