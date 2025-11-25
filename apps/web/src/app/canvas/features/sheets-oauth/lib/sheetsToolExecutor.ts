/**
 * Google Sheets Tool Executor (Client-Side)
 *
 * Client-side execution of Sheets tool calls via HTTP.
 * Used for direct chat in GenesisBotChatModal.
 */

import type { SheetsOAuthConfig, SheetsOperationResult } from '../types';

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ToolResult {
  toolCallId: string;
  result: string;
  isError: boolean;
}

/**
 * Execute a Sheets tool call via HTTP
 */
export async function executeSheetsToolCall(
  toolCall: ToolCall,
  userId: string,
  nodeId: string,
  permissions: SheetsOAuthConfig['permissions']
): Promise<ToolResult> {
  try {
    const response = await fetch('/api/canvas/sheets/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        nodeId,
        toolName: toolCall.name,
        parameters: toolCall.input,
        permissions,
      }),
    });

    const result: SheetsOperationResult = await response.json();

    if (!result.success) {
      return {
        toolCallId: toolCall.id,
        result: JSON.stringify({ error: result.error }),
        isError: true,
      };
    }

    return {
      toolCallId: toolCall.id,
      result: JSON.stringify(result.data),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      result: JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to execute Sheets tool',
      }),
      isError: true,
    };
  }
}

/**
 * Execute multiple Sheets tool calls
 */
export async function executeSheetsToolCalls(
  toolCalls: ToolCall[],
  userId: string,
  nodeId: string,
  permissions: SheetsOAuthConfig['permissions']
): Promise<ToolResult[]> {
  const results = await Promise.all(
    toolCalls.map((tc) => executeSheetsToolCall(tc, userId, nodeId, permissions))
  );
  return results;
}

/**
 * Check if a tool name is a Sheets tool
 */
export function isSheetsTool(toolName: string): boolean {
  return toolName.startsWith('sheets_');
}

/**
 * Filter Sheets tools from a list of tool calls
 */
export function filterSheetsToolCalls(toolCalls: ToolCall[]): ToolCall[] {
  return toolCalls.filter((tc) => isSheetsTool(tc.name));
}

/**
 * Generate system prompt for Sheets capabilities
 */
export function generateSheetsSystemPrompt(config: SheetsOAuthConfig): string {
  if (!config.enabled) {
    return '';
  }

  const capabilities: string[] = [];

  if (config.permissions.canRead) {
    capabilities.push('- Read spreadsheet data (sheets_read, sheets_batch_read)');
    capabilities.push('- Get spreadsheet metadata (sheets_get_metadata)');
  }
  if (config.permissions.canWrite) {
    capabilities.push('- Write data to spreadsheets (sheets_write)');
    capabilities.push('- Append rows to spreadsheets (sheets_append)');
    capabilities.push('- Clear ranges (sheets_clear)');
    capabilities.push('- Add new sheets/tabs (sheets_add_sheet)');
  }
  if (config.permissions.canCreate) {
    capabilities.push('- Create new spreadsheets (sheets_create)');
  }

  if (capabilities.length === 0) {
    return '';
  }

  return `📊 GOOGLE SHEETS INTEGRATION: You have access to the user's Google Sheets with the following capabilities:

${capabilities.join('\n')}

When working with spreadsheets:
- Use A1 notation for ranges (e.g., "Sheet1!A1:D10", "A:D", "1:10")
- The spreadsheet ID is found in the URL: docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
- For writing data, provide values as a 2D array where each inner array is a row
- Use valueInputOption "USER_ENTERED" to have values parsed like typed input (handles formulas, dates, etc.)
- Use valueInputOption "RAW" to write literal values without parsing

Be careful with write operations as they will modify the user's data.`;
}
