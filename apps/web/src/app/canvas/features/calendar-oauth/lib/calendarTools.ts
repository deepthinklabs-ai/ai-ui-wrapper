/**
 * Calendar Tools for AI
 *
 * Tool definitions that can be provided to Claude/OpenAI for Google Calendar operations.
 * These tools allow Genesis Bots to interact with Google Calendar on behalf of users.
 */

import type { CalendarToolDefinition, CalendarPermissions } from '../types';

/**
 * All available Calendar tools
 */
export const calendarTools: CalendarToolDefinition[] = [
  {
    name: 'calendar_list_events',
    description:
      'List upcoming events from the Google Calendar. Returns events within a specified time range. By default, shows events for the next 7 days.',
    inputSchema: {
      type: 'object',
      properties: {
        calendarId: {
          type: 'string',
          description: 'Calendar ID to list events from. Use "primary" for the main calendar (default).',
          default: 'primary',
        },
        timeMin: {
          type: 'string',
          description: 'Start of time range (ISO 8601 format, e.g., "2024-01-15T00:00:00Z"). Defaults to now.',
        },
        timeMax: {
          type: 'string',
          description: 'End of time range (ISO 8601 format). Defaults to 7 days from now.',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of events to return (default: 10, max: 50)',
          default: 10,
        },
        query: {
          type: 'string',
          description: 'Free text search terms to filter events (searches summary, description, location, attendees)',
        },
      },
      required: [],
    },
    requiredPermission: 'canRead',
  },
  {
    name: 'calendar_get_event',
    description:
      'Get details of a specific calendar event by its ID.',
    inputSchema: {
      type: 'object',
      properties: {
        calendarId: {
          type: 'string',
          description: 'Calendar ID (default: "primary")',
          default: 'primary',
        },
        eventId: {
          type: 'string',
          description: 'The ID of the event to retrieve',
        },
      },
      required: ['eventId'],
    },
    requiredPermission: 'canRead',
  },
  {
    name: 'calendar_create_event',
    description:
      'Create a new calendar event. Can create both timed events and all-day events. Use with caution - this will actually create an event on the calendar.',
    inputSchema: {
      type: 'object',
      properties: {
        calendarId: {
          type: 'string',
          description: 'Calendar ID to create the event in (default: "primary")',
          default: 'primary',
        },
        summary: {
          type: 'string',
          description: 'Event title/summary',
        },
        description: {
          type: 'string',
          description: 'Event description or notes',
        },
        location: {
          type: 'string',
          description: 'Event location (address or place name)',
        },
        startDateTime: {
          type: 'string',
          description: 'Start date and time for timed events (ISO 8601 format, e.g., "2024-01-15T10:00:00"). Required for timed events.',
        },
        endDateTime: {
          type: 'string',
          description: 'End date and time for timed events (ISO 8601 format). Required for timed events.',
        },
        startDate: {
          type: 'string',
          description: 'Start date for all-day events (YYYY-MM-DD format). Use this OR startDateTime, not both.',
        },
        endDate: {
          type: 'string',
          description: 'End date for all-day events (YYYY-MM-DD format). For a single all-day event, use the next day.',
        },
        timeZone: {
          type: 'string',
          description: 'Time zone for the event (e.g., "America/New_York", "Europe/London"). Defaults to calendar\'s time zone.',
        },
        attendees: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of attendee email addresses to invite',
        },
        sendNotifications: {
          type: 'boolean',
          description: 'Whether to send email notifications to attendees (default: true)',
          default: true,
        },
        reminders: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              method: {
                type: 'string',
                enum: ['email', 'popup'],
                description: 'Reminder method',
              },
              minutes: {
                type: 'number',
                description: 'Minutes before event to send reminder',
              },
            },
            required: ['method', 'minutes'],
          },
          description: 'Custom reminders (e.g., [{"method": "popup", "minutes": 30}])',
        },
      },
      required: ['summary'],
    },
    requiredPermission: 'canCreate',
  },
  {
    name: 'calendar_update_event',
    description:
      'Update an existing calendar event. Only specify the fields you want to change.',
    inputSchema: {
      type: 'object',
      properties: {
        calendarId: {
          type: 'string',
          description: 'Calendar ID (default: "primary")',
          default: 'primary',
        },
        eventId: {
          type: 'string',
          description: 'The ID of the event to update',
        },
        summary: {
          type: 'string',
          description: 'New event title/summary',
        },
        description: {
          type: 'string',
          description: 'New event description',
        },
        location: {
          type: 'string',
          description: 'New event location',
        },
        startDateTime: {
          type: 'string',
          description: 'New start date and time (ISO 8601 format)',
        },
        endDateTime: {
          type: 'string',
          description: 'New end date and time (ISO 8601 format)',
        },
        startDate: {
          type: 'string',
          description: 'New start date for all-day events (YYYY-MM-DD)',
        },
        endDate: {
          type: 'string',
          description: 'New end date for all-day events (YYYY-MM-DD)',
        },
        timeZone: {
          type: 'string',
          description: 'Time zone for the event',
        },
        attendees: {
          type: 'array',
          items: { type: 'string' },
          description: 'New list of attendee email addresses (replaces existing)',
        },
        sendNotifications: {
          type: 'boolean',
          description: 'Whether to send update notifications to attendees',
          default: true,
        },
      },
      required: ['eventId'],
    },
    requiredPermission: 'canUpdate',
  },
  {
    name: 'calendar_delete_event',
    description:
      'Delete a calendar event. This action cannot be undone.',
    inputSchema: {
      type: 'object',
      properties: {
        calendarId: {
          type: 'string',
          description: 'Calendar ID (default: "primary")',
          default: 'primary',
        },
        eventId: {
          type: 'string',
          description: 'The ID of the event to delete',
        },
        sendNotifications: {
          type: 'boolean',
          description: 'Whether to send cancellation notifications to attendees',
          default: true,
        },
      },
      required: ['eventId'],
    },
    requiredPermission: 'canDelete',
  },
  {
    name: 'calendar_list_calendars',
    description:
      'List all calendars the user has access to (own calendars and shared calendars).',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
    requiredPermission: 'canRead',
  },
  {
    name: 'calendar_quick_add',
    description:
      'Quickly add an event using natural language. Google parses the text to extract event details. Example: "Meeting with John tomorrow at 3pm for 1 hour"',
    inputSchema: {
      type: 'object',
      properties: {
        calendarId: {
          type: 'string',
          description: 'Calendar ID (default: "primary")',
          default: 'primary',
        },
        text: {
          type: 'string',
          description: 'Natural language text describing the event (e.g., "Lunch with Sarah on Friday at noon")',
        },
        sendNotifications: {
          type: 'boolean',
          description: 'Whether to send notifications',
          default: true,
        },
      },
      required: ['text'],
    },
    requiredPermission: 'canCreate',
  },
  {
    name: 'calendar_find_free_time',
    description:
      'Find free/busy time slots for scheduling. Useful for finding available meeting times.',
    inputSchema: {
      type: 'object',
      properties: {
        timeMin: {
          type: 'string',
          description: 'Start of time range to check (ISO 8601 format)',
        },
        timeMax: {
          type: 'string',
          description: 'End of time range to check (ISO 8601 format)',
        },
        calendars: {
          type: 'array',
          items: { type: 'string' },
          description: 'Calendar IDs to check (default: ["primary"])',
        },
        timeZone: {
          type: 'string',
          description: 'Time zone for the results',
        },
      },
      required: ['timeMin', 'timeMax'],
    },
    requiredPermission: 'canRead',
  },
];

/**
 * Get tools that are enabled based on permissions
 */
export function getEnabledCalendarTools(permissions: CalendarPermissions | undefined): CalendarToolDefinition[] {
  // Return empty array if permissions are not defined
  if (!permissions) {
    return [];
  }
  return calendarTools.filter((tool) => permissions[tool.requiredPermission]);
}

/**
 * Convert Calendar tools to Claude tool format
 */
export function toClaudeToolFormat(tools: CalendarToolDefinition[]) {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  }));
}

/**
 * Convert Calendar tools to OpenAI function format
 */
export function toOpenAIFunctionFormat(tools: CalendarToolDefinition[]) {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  }));
}
