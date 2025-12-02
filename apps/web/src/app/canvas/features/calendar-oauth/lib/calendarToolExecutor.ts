/**
 * Calendar Tool Executor (Client-Side)
 *
 * Executes Calendar tools via HTTP API calls.
 * Use this on the client-side. For server-side, use calendarToolExecutorServer.ts.
 */

import type { CalendarPermissions, CalendarOperationResult } from '../types';

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
 * Execute a single Calendar tool call via HTTP
 */
export async function executeCalendarToolCall(
  toolCall: ToolCall,
  userId: string,
  nodeId: string,
  permissions: CalendarPermissions
): Promise<ToolResult> {
  try {
    const response = await fetch('/api/canvas/calendar/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        nodeId,
        toolName: toolCall.name,
        parameters: toolCall.input,
        permissions,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        toolCallId: toolCall.id,
        result: JSON.stringify({ error: data.error || 'Failed to execute Calendar tool' }),
        isError: true,
      };
    }

    return {
      toolCallId: toolCall.id,
      result: JSON.stringify(data.data),
      isError: false,
    };
  } catch (error) {
    return {
      toolCallId: toolCall.id,
      result: JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to execute Calendar tool',
      }),
      isError: true,
    };
  }
}

/**
 * Execute multiple Calendar tool calls
 */
export async function executeCalendarToolCalls(
  toolCalls: ToolCall[],
  userId: string,
  nodeId: string,
  permissions: CalendarPermissions
): Promise<ToolResult[]> {
  const results = await Promise.all(
    toolCalls.map((tc) => executeCalendarToolCall(tc, userId, nodeId, permissions))
  );
  return results;
}

/**
 * Check if Calendar is connected for a user
 */
export async function checkCalendarConnection(userId: string): Promise<{
  connected: boolean;
  email?: string;
  status: string;
}> {
  try {
    const response = await fetch(`/api/canvas/calendar/status?userId=${userId}`);
    const data = await response.json();
    return data;
  } catch {
    return { connected: false, status: 'error' };
  }
}

/**
 * Generate system prompt additions for Calendar-enabled bots
 */
export function generateCalendarSystemPrompt(permissions: CalendarPermissions): string {
  const capabilities: string[] = [];

  if (permissions.canRead) {
    capabilities.push('- View calendar events and check availability');
    capabilities.push('- Search for events');
    capabilities.push('- List all calendars');
    capabilities.push('- Find free time slots');
  }

  if (permissions.canCreate) {
    capabilities.push('- Create new calendar events');
    capabilities.push('- Schedule meetings with attendees');
    capabilities.push('- Use natural language to quickly add events');
  }

  if (permissions.canUpdate) {
    capabilities.push('- Update existing events (time, location, attendees, etc.)');
  }

  if (permissions.canDelete) {
    capabilities.push('- Delete calendar events');
  }

  if (permissions.canManageReminders) {
    capabilities.push('- Set and manage event reminders');
  }

  if (capabilities.length === 0) {
    return '';
  }

  return `
## Google Calendar Integration

You have access to the user's Google Calendar. You can:
${capabilities.join('\n')}

IMPORTANT - Be action-oriented:
- When the user asks to add/create a calendar event, JUST DO IT immediately - do not ask for confirmation
- Use reasonable defaults for any missing details (15-min duration, 10-min popup reminder, primary calendar)
- Infer the timezone from context or use America/Los_Angeles as default
- Only ask questions if critical information is truly missing (like date/time for a meeting)
- After creating an event, briefly confirm what was created

Technical notes:
- Use ISO 8601 format for dates and times (e.g., "2024-01-15T10:00:00")
- For all-day events, use YYYY-MM-DD format

Available calendar tools: calendar_list_events, calendar_get_event, calendar_create_event, calendar_update_event, calendar_delete_event, calendar_list_calendars, calendar_quick_add, calendar_find_free_time
`;
}
