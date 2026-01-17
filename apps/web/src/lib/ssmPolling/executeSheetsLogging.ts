/**
 * SSM Sheets Logging Executor
 *
 * Handles logging SSM events to Google Sheets.
 * Used by both manual poll and background cron job.
 *
 * Features:
 * - Creates spreadsheet if it doesn't exist
 * - Adds headers if configured
 * - Caches spreadsheet ID in node config
 * - Batch processes multiple events
 */

import { createClient } from '@supabase/supabase-js';
import { getSheetsClient, getDriveClient } from '@/lib/googleClients';
import type { SSMEvent, SSMAlert, SSMSheetsActionConfig, SSMSheetsField } from '@/app/canvas/types/ssm';
import type { SheetsLogResult } from './types';

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ============================================================================
// BATCH SHEETS LOGGING
// ============================================================================

/**
 * Log multiple events to Google Sheets
 *
 * @param userId - User ID for OAuth
 * @param events - Events to log
 * @param alerts - Corresponding alerts
 * @param config - Sheets action configuration
 * @param nodeId - Node ID for caching spreadsheet ID
 * @returns Result with row count
 */
export async function executeSheetsLogging(
  userId: string,
  events: SSMEvent[],
  alerts: SSMAlert[],
  config: SSMSheetsActionConfig,
  nodeId: string
): Promise<SheetsLogResult> {
  // If sheets logging is not enabled, skip
  if (!config.enabled) {
    return { success: true, rows_logged: 0 };
  }

  // If no events, skip
  if (events.length === 0) {
    return { success: true, rows_logged: 0 };
  }

  const supabase = getSupabaseAdmin();
  let rowsLogged = 0;

  try {
    // Get Sheets and Drive clients
    const sheets = await getSheetsClient(userId);
    const drive = await getDriveClient(userId);

    let spreadsheetId = config.spreadsheetId || config.cachedSpreadsheetId;

    // If no spreadsheet ID, try to find or create the spreadsheet
    if (!spreadsheetId) {
      spreadsheetId = await findOrCreateSpreadsheet(
        sheets,
        drive,
        config,
        supabase,
        nodeId
      );
    }

    if (!spreadsheetId) {
      return { success: false, error: 'Failed to get or create spreadsheet', rows_logged: 0 };
    }

    // Create event-to-alert mapping
    const alertMap = new Map<string, SSMAlert>();
    for (const alert of alerts) {
      alertMap.set(alert.event_id, alert);
    }

    // Log each event that has an alert
    for (const event of events) {
      const alert = alertMap.get(event.id);
      if (!alert) continue;

      try {
        // Extract field values from the event
        const rowData = config.columns.map(col => extractFieldValue(col.field, event, alert));

        // Append row to the spreadsheet
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${config.sheetName || 'Events'}!A:Z`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: {
            values: [rowData],
          },
        });

        rowsLogged++;
      } catch (rowError) {
        console.error(`[SSM Sheets] Failed to log event ${event.id}:`, rowError instanceof Error ? rowError.message : rowError);
        // Continue with other events
      }
    }

    console.log(`[SSM Sheets] Logged ${rowsLogged} rows to spreadsheet ${spreadsheetId}`);

    return {
      success: true,
      spreadsheetId,
      rows_logged: rowsLogged,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to log to sheets';
    console.error('[SSM Sheets] Error:', errorMsg);
    return {
      success: false,
      error: errorMsg,
      rows_logged: rowsLogged,
    };
  }
}

// ============================================================================
// SINGLE EVENT LOGGING (for compatibility with existing code)
// ============================================================================

/**
 * Log a single event to Google Sheets
 */
export async function logEventToSheets(
  userId: string,
  event: SSMEvent,
  alert: SSMAlert,
  config: SSMSheetsActionConfig,
  nodeId: string
): Promise<SheetsLogResult> {
  return executeSheetsLogging(userId, [event], [alert], config, nodeId);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Find or create a spreadsheet by name
 */
async function findOrCreateSpreadsheet(
  sheets: Awaited<ReturnType<typeof getSheetsClient>>,
  drive: Awaited<ReturnType<typeof getDriveClient>>,
  config: SSMSheetsActionConfig,
  supabase: ReturnType<typeof getSupabaseAdmin>,
  nodeId: string
): Promise<string | undefined> {
  // Search for existing spreadsheet by name
  const searchResponse = await drive.files.list({
    q: `name='${config.spreadsheetName}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
    spaces: 'drive',
    fields: 'files(id, name)',
  });

  const existingFiles = searchResponse.data.files || [];

  if (existingFiles.length > 0 && existingFiles[0].id) {
    console.log(`[SSM Sheets] Found existing spreadsheet: ${existingFiles[0].id}`);
    return existingFiles[0].id;
  }

  if (!config.createIfMissing) {
    return undefined;
  }

  // Create new spreadsheet
  const createResponse = await sheets.spreadsheets.create({
    requestBody: {
      properties: {
        title: config.spreadsheetName,
      },
      sheets: [
        {
          properties: {
            title: config.sheetName || 'Events',
          },
        },
      ],
    },
  });

  const spreadsheetId = createResponse.data.spreadsheetId ?? undefined;
  console.log(`[SSM Sheets] Created new spreadsheet: ${spreadsheetId}`);

  if (!spreadsheetId) {
    return undefined;
  }

  // Add headers if configured
  if (config.includeHeaders && config.columns.length > 0) {
    const headers = config.columns.map(col => col.header);
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${config.sheetName || 'Events'}!A1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers],
      },
    });
    console.log(`[SSM Sheets] Added headers: ${headers.join(', ')}`);
  }

  // Cache the spreadsheet ID in the node's runtime_config
  try {
    const { data: node } = await supabase
      .from('canvas_nodes')
      .select('runtime_config')
      .eq('id', nodeId)
      .single();

    if (node) {
      await supabase
        .from('canvas_nodes')
        .update({
          runtime_config: {
            ...node.runtime_config,
            sheets_spreadsheet_id: spreadsheetId,
          },
        })
        .eq('id', nodeId);
    }
  } catch (cacheError) {
    console.warn('[SSM Sheets] Failed to cache spreadsheet ID:', cacheError instanceof Error ? cacheError.message : cacheError);
    // Non-fatal, continue
  }

  return spreadsheetId;
}

/**
 * Extract a field value from an SSM event for Sheets logging
 */
function extractFieldValue(field: SSMSheetsField, event: SSMEvent, alert: SSMAlert): string {
  switch (field) {
    case 'from':
      return String(event.metadata?.from || '');
    case 'subject':
      return String(event.metadata?.subject || '');
    case 'timestamp':
      return event.timestamp || new Date().toISOString();
    case 'body':
      // Get full body - extract from content after the header info
      const content = event.content || '';
      // For emails, body starts after the double newline following headers
      const bodyMatch = content.split('\n\n');
      return bodyMatch.length > 1 ? bodyMatch.slice(1).join('\n\n') : content;
    case 'body_preview':
      const preview = event.content || '';
      return preview.substring(0, 500);
    case 'matched_rules':
      return alert.matched_rules.join(', ');
    case 'severity':
      return alert.severity;
    case 'source':
      return event.source || '';
    case 'event_id':
      return event.id;
    default:
      return '';
  }
}
