/**
 * Google Sheets Tool Execution API Route
 *
 * Executes Sheets operations on behalf of Genesis Bot nodes.
 * Handles all Sheets tools: read, write, append, create, etc.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSheetsClient } from '@/lib/googleClients';
import type {
  SheetsPermissions,
  SheetsReadParams,
  SheetsWriteParams,
  SheetsAppendParams,
  SheetsCreateParams,
  SheetsMetadataParams,
  SheetsClearParams,
} from '@/app/canvas/features/sheets-oauth/types';

interface ExecuteRequest {
  userId: string;
  nodeId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  permissions: SheetsPermissions;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExecuteRequest = await request.json();
    const { userId, nodeId, toolName, parameters, permissions } = body;

    // Validate required fields
    if (!userId || !toolName) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, toolName' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Verify user has Pro tier
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', userId)
      .single();

    if (!profile || profile.tier !== 'pro') {
      return NextResponse.json(
        { error: 'Google Sheets integration requires Pro tier' },
        { status: 403 }
      );
    }

    // Get Sheets client
    let sheets;
    try {
      console.log(`[Sheets Execute] Getting Sheets client for user ${userId}`);
      sheets = await getSheetsClient(userId);
      console.log(`[Sheets Execute] Sheets client obtained successfully`);
    } catch (err) {
      console.error('[Sheets Execute] Failed to get Sheets client:', err);
      return NextResponse.json(
        {
          error: 'Google Sheets not connected or token expired. Please reconnect.',
          details: err instanceof Error ? err.message : 'Unknown error',
        },
        { status: 401 }
      );
    }

    // Execute the requested tool
    let result;
    switch (toolName) {
      case 'sheets_read':
        if (!permissions.canRead) {
          return NextResponse.json(
            { error: 'Read permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeRead(sheets, parameters as unknown as SheetsReadParams);
        break;

      case 'sheets_write':
        if (!permissions.canWrite) {
          return NextResponse.json(
            { error: 'Write permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeWrite(sheets, parameters as unknown as SheetsWriteParams);
        break;

      case 'sheets_append':
        if (!permissions.canWrite) {
          return NextResponse.json(
            { error: 'Write permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeAppend(sheets, parameters as unknown as SheetsAppendParams);
        break;

      case 'sheets_clear':
        if (!permissions.canWrite) {
          return NextResponse.json(
            { error: 'Write permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeClear(sheets, parameters as unknown as SheetsClearParams);
        break;

      case 'sheets_get_metadata':
        if (!permissions.canRead) {
          return NextResponse.json(
            { error: 'Read permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeGetMetadata(sheets, parameters as unknown as SheetsMetadataParams);
        break;

      case 'sheets_create':
        if (!permissions.canCreate) {
          return NextResponse.json(
            { error: 'Create permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeCreate(sheets, parameters as unknown as SheetsCreateParams);
        break;

      case 'sheets_batch_read':
        if (!permissions.canRead) {
          return NextResponse.json(
            { error: 'Read permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeBatchRead(sheets, parameters as any);
        break;

      case 'sheets_add_sheet':
        if (!permissions.canWrite) {
          return NextResponse.json(
            { error: 'Write permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeAddSheet(sheets, parameters as any);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown tool: ${toolName}` },
          { status: 400 }
        );
    }

    // Log tool usage
    console.log(`[Sheets Execute] User ${userId} | Node ${nodeId} | Tool: ${toolName} | Success`);
    console.log(`[Sheets Execute] Result:`, JSON.stringify(result).substring(0, 500));

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Sheets Execute] Error:', error);
    console.error('[Sheets Execute] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Tool execution functions

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
