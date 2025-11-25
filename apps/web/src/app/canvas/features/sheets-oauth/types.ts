/**
 * Google Sheets OAuth Feature Types
 *
 * Type definitions for Sheets integration in Genesis Bot nodes.
 */

/**
 * Sheets permissions that can be granted to a bot
 */
export interface SheetsPermissions {
  canRead: boolean;
  canWrite: boolean;
  canCreate: boolean;
  canFormat: boolean;
}

/**
 * Sheets OAuth configuration for a Genesis Bot node
 */
export interface SheetsOAuthConfig {
  enabled: boolean;
  connectionId: string | null;
  permissions: SheetsPermissions;
}

/**
 * Parameters for reading a spreadsheet
 */
export interface SheetsReadParams {
  spreadsheetId: string;
  range: string;
  majorDimension?: 'ROWS' | 'COLUMNS';
  valueRenderOption?: 'FORMATTED_VALUE' | 'UNFORMATTED_VALUE' | 'FORMULA';
}

/**
 * Parameters for writing to a spreadsheet
 */
export interface SheetsWriteParams {
  spreadsheetId: string;
  range: string;
  values: any[][];
  valueInputOption?: 'RAW' | 'USER_ENTERED';
}

/**
 * Parameters for appending to a spreadsheet
 */
export interface SheetsAppendParams {
  spreadsheetId: string;
  range: string;
  values: any[][];
  valueInputOption?: 'RAW' | 'USER_ENTERED';
  insertDataOption?: 'OVERWRITE' | 'INSERT_ROWS';
}

/**
 * Parameters for creating a spreadsheet
 */
export interface SheetsCreateParams {
  title: string;
  sheetTitles?: string[];
}

/**
 * Parameters for getting spreadsheet metadata
 */
export interface SheetsMetadataParams {
  spreadsheetId: string;
  includeGridData?: boolean;
}

/**
 * Parameters for clearing a range
 */
export interface SheetsClearParams {
  spreadsheetId: string;
  range: string;
}

/**
 * Parameters for batch update
 */
export interface SheetsBatchUpdateParams {
  spreadsheetId: string;
  ranges: string[];
  values: any[][][];
  valueInputOption?: 'RAW' | 'USER_ENTERED';
}

/**
 * Spreadsheet metadata
 */
export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  locale: string;
  timeZone: string;
  sheets: SheetMetadata[];
}

/**
 * Individual sheet metadata
 */
export interface SheetMetadata {
  sheetId: number;
  title: string;
  index: number;
  rowCount: number;
  columnCount: number;
}

/**
 * Result of a Sheets operation
 */
export interface SheetsOperationResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Tool definition for Claude
 */
export interface SheetsTool {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required: string[];
  };
  requiredPermission: keyof SheetsPermissions;
}

/**
 * Default Sheets OAuth configuration
 */
export const DEFAULT_SHEETS_CONFIG: SheetsOAuthConfig = {
  enabled: false,
  connectionId: null,
  permissions: {
    canRead: true,
    canWrite: false,
    canCreate: false,
    canFormat: false,
  },
};
