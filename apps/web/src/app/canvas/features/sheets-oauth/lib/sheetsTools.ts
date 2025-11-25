/**
 * Google Sheets Tool Definitions
 *
 * Defines the tools available for Sheets operations.
 * These are formatted for Claude's tool calling API.
 */

import type { SheetsTool, SheetsPermissions } from '../types';

/**
 * All available Sheets tools
 */
export const sheetsTools: SheetsTool[] = [
  {
    name: 'sheets_read',
    description: 'Read data from a Google Spreadsheet. Returns the values in the specified range. Use A1 notation for the range (e.g., "Sheet1!A1:D10" or just "A1:D10" for the first sheet).',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheetId: {
          type: 'string',
          description: 'The ID of the spreadsheet (found in the URL: docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit)',
        },
        range: {
          type: 'string',
          description: 'The A1 notation range to read (e.g., "Sheet1!A1:D10", "A:D", "1:10")',
        },
        valueRenderOption: {
          type: 'string',
          enum: ['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'],
          description: 'How values should be rendered. FORMATTED_VALUE returns display values, UNFORMATTED_VALUE returns raw values, FORMULA returns formulas.',
        },
      },
      required: ['spreadsheetId', 'range'],
    },
    requiredPermission: 'canRead',
  },
  {
    name: 'sheets_write',
    description: 'Write data to a Google Spreadsheet. Overwrites existing data in the specified range.',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheetId: {
          type: 'string',
          description: 'The ID of the spreadsheet',
        },
        range: {
          type: 'string',
          description: 'The A1 notation range to write to (e.g., "Sheet1!A1:D10")',
        },
        values: {
          type: 'array',
          items: {
            type: 'array',
            items: { type: ['string', 'number', 'boolean', 'null'] },
          },
          description: 'The data to write as a 2D array. Each inner array is a row.',
        },
        valueInputOption: {
          type: 'string',
          enum: ['RAW', 'USER_ENTERED'],
          description: 'How input should be interpreted. RAW treats input as literal values, USER_ENTERED parses as if typed by user (handles formulas, dates, etc.).',
        },
      },
      required: ['spreadsheetId', 'range', 'values'],
    },
    requiredPermission: 'canWrite',
  },
  {
    name: 'sheets_append',
    description: 'Append rows to a Google Spreadsheet. Adds data after the last row with content in the specified range.',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheetId: {
          type: 'string',
          description: 'The ID of the spreadsheet',
        },
        range: {
          type: 'string',
          description: 'The A1 notation of the range to search for data (e.g., "Sheet1!A:D"). Data will be appended after the last row.',
        },
        values: {
          type: 'array',
          items: {
            type: 'array',
            items: { type: ['string', 'number', 'boolean', 'null'] },
          },
          description: 'The rows to append as a 2D array.',
        },
        valueInputOption: {
          type: 'string',
          enum: ['RAW', 'USER_ENTERED'],
          description: 'How input should be interpreted. Default is USER_ENTERED.',
        },
      },
      required: ['spreadsheetId', 'range', 'values'],
    },
    requiredPermission: 'canWrite',
  },
  {
    name: 'sheets_clear',
    description: 'Clear data from a range in a Google Spreadsheet. Removes values but keeps formatting.',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheetId: {
          type: 'string',
          description: 'The ID of the spreadsheet',
        },
        range: {
          type: 'string',
          description: 'The A1 notation range to clear (e.g., "Sheet1!A1:D10")',
        },
      },
      required: ['spreadsheetId', 'range'],
    },
    requiredPermission: 'canWrite',
  },
  {
    name: 'sheets_get_metadata',
    description: 'Get metadata about a Google Spreadsheet including title, sheets, and their properties.',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheetId: {
          type: 'string',
          description: 'The ID of the spreadsheet',
        },
      },
      required: ['spreadsheetId'],
    },
    requiredPermission: 'canRead',
  },
  {
    name: 'sheets_create',
    description: 'Create a new Google Spreadsheet.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'The title for the new spreadsheet',
        },
        sheetTitles: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional array of sheet names to create. If not provided, creates one sheet named "Sheet1".',
        },
      },
      required: ['title'],
    },
    requiredPermission: 'canCreate',
  },
  {
    name: 'sheets_batch_read',
    description: 'Read multiple ranges from a Google Spreadsheet in a single request.',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheetId: {
          type: 'string',
          description: 'The ID of the spreadsheet',
        },
        ranges: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of A1 notation ranges to read (e.g., ["Sheet1!A1:B10", "Sheet2!C1:D5"])',
        },
        valueRenderOption: {
          type: 'string',
          enum: ['FORMATTED_VALUE', 'UNFORMATTED_VALUE', 'FORMULA'],
          description: 'How values should be rendered.',
        },
      },
      required: ['spreadsheetId', 'ranges'],
    },
    requiredPermission: 'canRead',
  },
  {
    name: 'sheets_add_sheet',
    description: 'Add a new sheet (tab) to an existing Google Spreadsheet.',
    input_schema: {
      type: 'object',
      properties: {
        spreadsheetId: {
          type: 'string',
          description: 'The ID of the spreadsheet',
        },
        title: {
          type: 'string',
          description: 'The title for the new sheet',
        },
        rowCount: {
          type: 'number',
          description: 'Optional number of rows for the new sheet (default: 1000)',
        },
        columnCount: {
          type: 'number',
          description: 'Optional number of columns for the new sheet (default: 26)',
        },
      },
      required: ['spreadsheetId', 'title'],
    },
    requiredPermission: 'canWrite',
  },
];

/**
 * Get tools that are enabled based on permissions
 */
export function getEnabledSheetsTools(permissions: SheetsPermissions): SheetsTool[] {
  return sheetsTools.filter((tool) => {
    switch (tool.requiredPermission) {
      case 'canRead':
        return permissions.canRead;
      case 'canWrite':
        return permissions.canWrite;
      case 'canCreate':
        return permissions.canCreate;
      case 'canFormat':
        return permissions.canFormat;
      default:
        return false;
    }
  });
}

/**
 * Convert tools to Claude's expected format
 */
export function toClaudeToolFormat(tools: SheetsTool[]): any[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  }));
}
