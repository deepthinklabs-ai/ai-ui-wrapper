/**
 * Google Sheets Utility Functions
 *
 * Helper functions for working with Sheets data.
 */

/**
 * Extract spreadsheet ID from a Google Sheets URL
 */
export function extractSpreadsheetId(url: string): string | null {
  // Match patterns like:
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Validate a spreadsheet ID format
 */
export function isValidSpreadsheetId(id: string): boolean {
  // Spreadsheet IDs are typically 44 characters of alphanumeric, dash, underscore
  return /^[a-zA-Z0-9-_]{20,50}$/.test(id);
}

/**
 * Convert column letter to index (A=0, B=1, ..., Z=25, AA=26, etc.)
 */
export function columnLetterToIndex(letter: string): number {
  let result = 0;
  for (let i = 0; i < letter.length; i++) {
    result = result * 26 + (letter.charCodeAt(i) - 64);
  }
  return result - 1;
}

/**
 * Convert column index to letter (0=A, 1=B, ..., 25=Z, 26=AA, etc.)
 */
export function columnIndexToLetter(index: number): string {
  let result = '';
  let temp = index + 1;
  while (temp > 0) {
    temp--;
    result = String.fromCharCode((temp % 26) + 65) + result;
    temp = Math.floor(temp / 26);
  }
  return result;
}

/**
 * Parse A1 notation into components
 */
export function parseA1Notation(a1: string): {
  sheetName?: string;
  startColumn: string;
  startRow: number;
  endColumn?: string;
  endRow?: number;
} | null {
  // Match patterns like:
  // A1, A1:B10, Sheet1!A1, Sheet1!A1:B10, A:B, 1:10
  const match = a1.match(/^(?:'?([^'!]+)'?!)?([A-Z]+)?(\d+)?(?::([A-Z]+)?(\d+)?)?$/i);

  if (!match) return null;

  const [, sheetName, startCol, startRowStr, endCol, endRowStr] = match;

  return {
    sheetName: sheetName || undefined,
    startColumn: startCol?.toUpperCase() || 'A',
    startRow: startRowStr ? parseInt(startRowStr, 10) : 1,
    endColumn: endCol?.toUpperCase() || undefined,
    endRow: endRowStr ? parseInt(endRowStr, 10) : undefined,
  };
}

/**
 * Format a 2D array as a simple text table
 */
export function formatAsTable(values: any[][]): string {
  if (!values || values.length === 0) {
    return '(empty)';
  }

  // Calculate column widths
  const colWidths: number[] = [];
  for (const row of values) {
    for (let i = 0; i < row.length; i++) {
      const cellStr = String(row[i] ?? '');
      colWidths[i] = Math.max(colWidths[i] || 0, cellStr.length, 3);
    }
  }

  // Limit column widths
  const maxColWidth = 30;
  const limitedWidths = colWidths.map(w => Math.min(w, maxColWidth));

  // Build table
  const lines: string[] = [];
  for (let rowIdx = 0; rowIdx < values.length; rowIdx++) {
    const row = values[rowIdx];
    const cells = row.map((cell, i) => {
      const str = String(cell ?? '');
      const width = limitedWidths[i];
      if (str.length > width) {
        return str.substring(0, width - 2) + '..';
      }
      return str.padEnd(width);
    });
    lines.push('| ' + cells.join(' | ') + ' |');

    // Add separator after header row
    if (rowIdx === 0) {
      const separator = limitedWidths.map(w => '-'.repeat(w)).join('-+-');
      lines.push('+-' + separator + '-+');
    }
  }

  return lines.join('\n');
}

/**
 * Summarize spreadsheet data for display
 */
export function summarizeSpreadsheetData(values: any[][], maxRows: number = 5): string {
  if (!values || values.length === 0) {
    return 'No data found in the specified range.';
  }

  const totalRows = values.length;
  const totalCols = Math.max(...values.map(r => r.length));

  let summary = `Found ${totalRows} rows and ${totalCols} columns.\n\n`;

  // Show first few rows
  const previewRows = values.slice(0, maxRows);
  summary += formatAsTable(previewRows);

  if (totalRows > maxRows) {
    summary += `\n... and ${totalRows - maxRows} more rows`;
  }

  return summary;
}

/**
 * Convert spreadsheet values to CSV format
 */
export function valuesToCSV(values: any[][]): string {
  return values
    .map(row =>
      row
        .map(cell => {
          const str = String(cell ?? '');
          // Escape quotes and wrap in quotes if contains comma, quote, or newline
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return '"' + str.replace(/"/g, '""') + '"';
          }
          return str;
        })
        .join(',')
    )
    .join('\n');
}

/**
 * Parse CSV string to 2D array
 */
export function csvToValues(csv: string): string[][] {
  const lines: string[][] = [];
  let currentLine: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < csv.length; i++) {
    const char = csv[i];
    const nextChar = csv[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++; // Skip next quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentLine.push(currentCell);
        currentCell = '';
      } else if (char === '\n' || (char === '\r' && nextChar === '\n')) {
        currentLine.push(currentCell);
        lines.push(currentLine);
        currentLine = [];
        currentCell = '';
        if (char === '\r') i++; // Skip \n in \r\n
      } else if (char !== '\r') {
        currentCell += char;
      }
    }
  }

  // Don't forget last cell/line
  if (currentCell || currentLine.length > 0) {
    currentLine.push(currentCell);
    lines.push(currentLine);
  }

  return lines;
}
