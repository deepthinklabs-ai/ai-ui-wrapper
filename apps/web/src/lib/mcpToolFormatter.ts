/**
 * MCP Tool Formatter
 *
 * Converts MCP tools to LLM-compatible tool definitions.
 * Supports Claude (Anthropic) and OpenAI tool calling formats.
 */

import type { MCPTool } from "./mcpClient";

export type ClaudeToolDefinition = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, any>;
    required?: string[];
  };
};

export type OpenAIToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, any>;
      required?: string[];
    };
  };
};

/**
 * Convert MCP tools to Claude tool format
 */
export function formatToolsForClaude(
  tools: Array<MCPTool & { serverId: string; serverName: string }>
): ClaudeToolDefinition[] {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description || `Tool from ${tool.serverName}`,
    input_schema: {
      type: "object",
      properties: tool.inputSchema?.properties || {},
      required: tool.inputSchema?.required || [],
    },
  }));
}

/**
 * Convert MCP tools to OpenAI tool format
 */
export function formatToolsForOpenAI(
  tools: Array<MCPTool & { serverId: string; serverName: string }>
): OpenAIToolDefinition[] {
  return tools.map(tool => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description || `Tool from ${tool.serverName}`,
      parameters: {
        type: "object",
        properties: tool.inputSchema?.properties || {},
        required: tool.inputSchema?.required || [],
      },
    },
  }));
}

/**
 * Parse Claude tool use from response
 */
export function parseClaudeToolUse(content: any[]): Array<{
  id: string;
  name: string;
  input: Record<string, any>;
}> {
  const toolCalls: Array<{
    id: string;
    name: string;
    input: Record<string, any>;
  }> = [];

  for (const block of content) {
    if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        name: block.name,
        input: block.input,
      });
    }
  }

  return toolCalls;
}

/**
 * Parse OpenAI tool calls from response
 */
export function parseOpenAIToolCalls(toolCalls: any[]): Array<{
  id: string;
  name: string;
  input: Record<string, any>;
}> {
  return toolCalls.map(call => ({
    id: call.id,
    name: call.function.name,
    input: JSON.parse(call.function.arguments),
  }));
}

/**
 * Format tool result for Claude
 */
export function formatToolResultForClaude(
  toolUseId: string,
  result: any,
  isError: boolean = false
): any {
  return {
    type: "tool_result",
    tool_use_id: toolUseId,
    content: isError
      ? `Error: ${result}`
      : typeof result === "string"
      ? result
      : JSON.stringify(result, null, 2),
    is_error: isError,
  };
}

/**
 * Format tool result for OpenAI
 */
export function formatToolResultForOpenAI(
  toolCallId: string,
  result: any,
  isError: boolean = false
): any {
  return {
    role: "tool",
    tool_call_id: toolCallId,
    content: isError
      ? `Error: ${result}`
      : typeof result === "string"
      ? result
      : JSON.stringify(result, null, 2),
  };
}

/**
 * Find the MCP server that provides a tool
 */
export function findToolServer(
  toolName: string,
  tools: Array<MCPTool & { serverId: string; serverName: string }>
): { serverId: string; serverName: string } | null {
  const tool = tools.find(t => t.name === toolName);
  if (!tool) return null;

  return {
    serverId: tool.serverId,
    serverName: tool.serverName,
  };
}

/**
 * Format tool execution result for display
 */
export function formatToolResultForDisplay(
  toolName: string,
  result: any
): string {
  if (typeof result === "string") {
    return result;
  }

  if (result.content) {
    // MCP server response format
    if (Array.isArray(result.content)) {
      return result.content
        .map((item: any) => {
          if (item.type === "text") return item.text;
          if (item.type === "image") return "[Image]";
          if (item.type === "resource") return `[Resource: ${item.resource?.uri}]`;
          return JSON.stringify(item);
        })
        .join("\n");
    }
    return result.content;
  }

  // Fallback to JSON
  return JSON.stringify(result, null, 2);
}
