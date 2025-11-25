/**
 * Google Sheets Tool Executor (Server-Side)
 *
 * Server-side execution of Sheets tools - calls Sheets API directly.
 * Use this in API routes (server-side) instead of HTTP fetch.
 */

import { getSheetsClient } from '@/lib/googleClients';
import { createClient } from '@supabase/supabase-js';
import type {
  SheetsPermissions,
  SheetsReadParams,
  SheetsWriteParams,
  SheetsAppendParams,
  SheetsCreateParams,
  SheetsMetadataParams,
  SheetsClearParams,
} from '../types';

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
 * Execute a single Sheets tool call (server-side)
 */
export async function executeSheetsToolCallServer(
  toolCall: ToolCall,
  userId: string,
  nodeId: string,
  permissions: SheetsPermissions
): Promise<ToolResult> {
  try {
    console.log(`[Sheets Server] Executing tool: ${toolCall.name}`);
    console.log(`[Sheets Server] User: ${userId}, Node: ${nodeId}`);
    console.log(`[Sheets Server] Input:`, JSON.stringify(toolCall.input).substring(0, 200));

    // Verify Pro tier
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', userId)
      .single();

    if (!profile || profile.tier !== 'pro') {
      return {
        toolCallId: toolCall.id,
        result: JSON.stringify({ error: 'Google Sheets integration requires Pro tier' }),
        isError: true,
      };
    }

    // Get Sheets client
    let sheets;
    try {
      sheets = await getSheetsClient(userId);
      console.log(`[Sheets Server] Sheets client obtained successfully`);
    } catch (err) {
      console.error('[Sheets Server] Failed to get Sheets client:', err);
      return {
        toolCallId: toolCall.id,
        result: JSON.stringify({
          error: 'Google Sheets not connected or token expired. Please reconnect.',
          details: err instanceof Error ? err.message : 'Unknown error',
        }),
        isError: true,
      };
    }

    // Execute based on tool name
    let result;
    switch (toolCall.name) {
      case 'sheets_read':
        if (!permissions.canRead) {
          return {
            toolCallId: toolCall.id,
            result: JSON.stringify({ error: 'Read permission not granted' }),
            isError: true,
          };
        }
        result = await executeRead(sheets, toolCall.input as unknown as SheetsReadParams);
        break;

      case 'sheets_write':
        if (!permissions.canWrite) {
          return {
            toolCallId: toolCall.id,
            result: JSON.stringify({ error: 'Write permission not granted' }),
            isError: true,
          };
        }
        result = await executeWrite(sheets, toolCall.input as unknown as SheetsWriteParams);
        break;

      case 'sheets_append':
        if (!permissions.canWrite) {
          return {
            toolCallId: toolCall.id,
            result: JSON.stringify({ error: 'Write permission not granted' }),
            isError: true,
          };
        }
        result = await executeAppend(sheets, toolCall.input as unknown as SheetsAppendParams);
        break;

      case 'sheets_clear':
        if (!permissions.canWrite) {
          return {
            toolCallId: toolCall.id,
            result: JSON.stringify({ error: 'Write permission not granted' }),
            isError: true,
          };
        }
        result = await executeClear(sheets, toolCall.input as unknown as SheetsClearParams);
        break;

      case 'sheets_get_metadata':
        if (!permissions.canRead) {
          return {
            toolCallId: toolCall.id,
            result: JSON.stringify({ error: 'Read permission not granted' }),
            isError: true,
          };
        }
        result = await executeGetMetadata(sheets, toolCall.input as unknown as SheetsMetadataParams);
        break;

      case 'sheets_create':
        if (!permissions.canCreate) {
          return {
            toolCallId: toolCall.id,
            result: JSON.stringify({ error: 'Create permission not granted' }),
            isError: true,
          };
        }
        result = await executeCreate(sheets, toolCall.input as unknown as SheetsCreateParams);
        break;

      case 'sheets_batch_read':
        if (!permissions.canRead) {
          return {
            toolCallId: toolCall.id,
            result: JSON.stringify({ error: 'Read permission not granted' }),
            isError: true,
          };
        }
        result = await executeBatchRead(sheets, toolCall.input as any);
        break;

      case 'sheets_add_sheet':
        if (!permissions.canWrite) {
          return {
            toolCallId: toolCall.id,
            result: JSON.stringify({ error: 'Write permission not granted' }),
            isError: true,
          };
        }
        result = await executeAddSheet(sheets, toolCall.input as any);
        break;

      default:
        return {
          toolCallId: toolCall.id,
          result: JSON.stringify({ error: `Unknown tool: ${toolCall.name}` }),
          isError: true,
        };
    }

    console.log(`[Sheets Server] Tool ${toolCall.name} executed successfully`);
    console.log(`[Sheets Server] Result preview:`, JSON.stringify(result).substring(0, 300));

    return {
      toolCallId: toolCall.id,
      result: JSON.stringify(result),
      isError: false,
    };
  } catch (error) {
    console.error(`[Sheets Server] Error executing ${toolCall.name}:`, error);
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
 * Execute multiple Sheets tool calls (server-side)
 */
export async function executeSheetsToolCallsServer(
  toolCalls: ToolCall[],
  userId: string,
  nodeId: string,
  permissions: SheetsPermissions
): Promise<ToolResult[]> {
  console.log(`[Sheets Server] Executing ${toolCalls.length} tool calls`);
  const results = await Promise.all(
    toolCalls.map((tc) => executeSheetsToolCallServer(tc, userId, nodeId, permissions))
  );
  return results;
}

// Sheets execution functions

async function executeRead(sheets: any, params: SheetsReadParams) {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: params.spreadsheetId,
    range: params.range,
    majorDimension: params.majorDimension || 'ROWS',
    valueRenderOption: params.valueRenderOption || 'FORMATTED_VALUE',
  });

  return {
    range: response.data.range,
    majorDimension: response.data.majorDimension,
    values: response.data.values || [],
    rowCount: response.data.values?.length || 0,
    columnCount: response.data.values?.[0]?.length || 0,
  };
}

async function executeWrite(sheets: any, params: SheetsWriteParams) {
  const response = await sheets.spreadsheets.values.update({
    spreadsheetId: params.spreadsheetId,
    range: params.range,
    valueInputOption: params.valueInputOption || 'USER_ENTERED',
    requestBody: {
      values: params.values,
    },
  });

  return {
    spreadsheetId: response.data.spreadsheetId,
    updatedRange: response.data.updatedRange,
    updatedRows: response.data.updatedRows,
    updatedColumns: response.data.updatedColumns,
    updatedCells: response.data.updatedCells,
  };
}

async function executeAppend(sheets: any, params: SheetsAppendParams) {
  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: params.spreadsheetId,
    range: params.range,
    valueInputOption: params.valueInputOption || 'USER_ENTERED',
    insertDataOption: params.insertDataOption || 'INSERT_ROWS',
    requestBody: {
      values: params.values,
    },
  });

  return {
    spreadsheetId: response.data.spreadsheetId,
    tableRange: response.data.tableRange,
    updates: {
      updatedRange: response.data.updates?.updatedRange,
      updatedRows: response.data.updates?.updatedRows,
      updatedColumns: response.data.updates?.updatedColumns,
      updatedCells: response.data.updates?.updatedCells,
    },
  };
}

async function executeClear(sheets: any, params: SheetsClearParams) {
  const response = await sheets.spreadsheets.values.clear({
    spreadsheetId: params.spreadsheetId,
    range: params.range,
  });

  return {
    spreadsheetId: response.data.spreadsheetId,
    clearedRange: response.data.clearedRange,
  };
}

async function executeGetMetadata(sheets: any, params: SheetsMetadataParams) {
  const response = await sheets.spreadsheets.get({
    spreadsheetId: params.spreadsheetId,
    includeGridData: params.includeGridData || false,
  });

  const spreadsheet = response.data;

  return {
    spreadsheetId: spreadsheet.spreadsheetId,
    title: spreadsheet.properties?.title,
    locale: spreadsheet.properties?.locale,
    timeZone: spreadsheet.properties?.timeZone,
    sheets: spreadsheet.sheets?.map((sheet: any) => ({
      sheetId: sheet.properties?.sheetId,
      title: sheet.properties?.title,
      index: sheet.properties?.index,
      rowCount: sheet.properties?.gridProperties?.rowCount,
      columnCount: sheet.properties?.gridProperties?.columnCount,
    })) || [],
  };
}

async function executeCreate(sheets: any, params: SheetsCreateParams) {
  const sheetProperties = params.sheetTitles?.map((title, index) => ({
    properties: {
      title,
      index,
    },
  })) || [{ properties: { title: 'Sheet1', index: 0 } }];

  const response = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: params.title,
      },
      sheets: sheetProperties,
    },
  });

  return {
    spreadsheetId: response.data.spreadsheetId,
    spreadsheetUrl: response.data.spreadsheetUrl,
    title: response.data.properties?.title,
    sheets: response.data.sheets?.map((sheet: any) => ({
      sheetId: sheet.properties?.sheetId,
      title: sheet.properties?.title,
    })) || [],
  };
}

async function executeBatchRead(sheets: any, params: { spreadsheetId: string; ranges: string[]; valueRenderOption?: string }) {
  const response = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: params.spreadsheetId,
    ranges: params.ranges,
    valueRenderOption: params.valueRenderOption || 'FORMATTED_VALUE',
  });

  return {
    spreadsheetId: response.data.spreadsheetId,
    valueRanges: response.data.valueRanges?.map((vr: any) => ({
      range: vr.range,
      majorDimension: vr.majorDimension,
      values: vr.values || [],
    })) || [],
  };
}

async function executeAddSheet(sheets: any, params: { spreadsheetId: string; title: string; rowCount?: number; columnCount?: number }) {
  const response = await sheets.spreadsheets.batchUpdate({
    spreadsheetId: params.spreadsheetId,
    requestBody: {
      requests: [
        {
          addSheet: {
            properties: {
              title: params.title,
              gridProperties: {
                rowCount: params.rowCount || 1000,
                columnCount: params.columnCount || 26,
              },
            },
          },
        },
      ],
    },
  });

  const addedSheet = response.data.replies?.[0]?.addSheet;

  return {
    sheetId: addedSheet?.properties?.sheetId,
    title: addedSheet?.properties?.title,
    index: addedSheet?.properties?.index,
    rowCount: addedSheet?.properties?.gridProperties?.rowCount,
    columnCount: addedSheet?.properties?.gridProperties?.columnCount,
  };
}
