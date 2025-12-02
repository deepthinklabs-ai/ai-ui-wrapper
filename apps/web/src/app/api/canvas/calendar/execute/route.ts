/**
 * Calendar Tool Execution API Route
 *
 * Executes Google Calendar operations on behalf of Genesis Bot nodes.
 * Handles all Calendar tools: list, create, update, delete events.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getCalendarClient } from '@/lib/googleClients';
import type { CalendarPermissions, CalendarEvent } from '@/app/canvas/features/calendar-oauth/types';

interface ExecuteRequest {
  userId: string;
  nodeId: string;
  toolName: string;
  parameters: Record<string, unknown>;
  permissions: CalendarPermissions;
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

    // Verify user has Pro tier (Calendar integration is a Pro feature)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('tier')
      .eq('id', userId)
      .single();

    if (!profile || profile.tier !== 'pro') {
      return NextResponse.json(
        { error: 'Calendar integration requires Pro tier' },
        { status: 403 }
      );
    }

    // Get Calendar client (handles token refresh)
    let calendar;
    try {
      console.log(`[Calendar Execute] Getting Calendar client for user ${userId}`);
      calendar = await getCalendarClient(userId);
      console.log(`[Calendar Execute] Calendar client obtained successfully`);
    } catch (err) {
      console.error('[Calendar Execute] Failed to get Calendar client:', err);
      return NextResponse.json(
        { error: 'Google Calendar not connected or token expired. Please reconnect.', details: err instanceof Error ? err.message : 'Unknown error' },
        { status: 401 }
      );
    }

    // Execute the requested tool
    let result;
    switch (toolName) {
      case 'calendar_list_events':
        if (!permissions.canRead) {
          return NextResponse.json(
            { error: 'Read permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeListEvents(calendar, parameters);
        break;

      case 'calendar_get_event':
        if (!permissions.canRead) {
          return NextResponse.json(
            { error: 'Read permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeGetEvent(calendar, parameters);
        break;

      case 'calendar_create_event':
        if (!permissions.canCreate) {
          return NextResponse.json(
            { error: 'Create permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeCreateEvent(calendar, parameters);
        break;

      case 'calendar_update_event':
        if (!permissions.canUpdate) {
          return NextResponse.json(
            { error: 'Update permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeUpdateEvent(calendar, parameters);
        break;

      case 'calendar_delete_event':
        if (!permissions.canDelete) {
          return NextResponse.json(
            { error: 'Delete permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeDeleteEvent(calendar, parameters);
        break;

      case 'calendar_list_calendars':
        if (!permissions.canRead) {
          return NextResponse.json(
            { error: 'Read permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeListCalendars(calendar);
        break;

      case 'calendar_quick_add':
        if (!permissions.canCreate) {
          return NextResponse.json(
            { error: 'Create permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeQuickAdd(calendar, parameters);
        break;

      case 'calendar_find_free_time':
        if (!permissions.canRead) {
          return NextResponse.json(
            { error: 'Read permission not granted for this bot' },
            { status: 403 }
          );
        }
        result = await executeFindFreeTime(calendar, parameters);
        break;

      default:
        return NextResponse.json(
          { error: `Unknown tool: ${toolName}` },
          { status: 400 }
        );
    }

    // Log tool usage
    console.log(`[Calendar Execute] User ${userId} | Node ${nodeId} | Tool: ${toolName} | Success`);
    console.log(`[Calendar Execute] Result:`, JSON.stringify(result).substring(0, 500));

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[Calendar Execute] Error:', error);
    console.error('[Calendar Execute] Error stack:', error instanceof Error ? error.stack : 'No stack');
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

async function executeListEvents(calendar: any, params: Record<string, unknown>) {
  const calendarId = (params.calendarId as string) || 'primary';
  const now = new Date();
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const timeMin = (params.timeMin as string) || now.toISOString();
  const timeMax = (params.timeMax as string) || sevenDaysLater.toISOString();
  const maxResults = Math.min((params.maxResults as number) || 10, 50);

  const requestParams: any = {
    calendarId,
    timeMin,
    timeMax,
    maxResults,
    singleEvents: true,
    orderBy: 'startTime',
  };

  if (params.query) {
    requestParams.q = params.query as string;
  }

  const response = await calendar.events.list(requestParams);
  const events = response.data.items || [];

  return {
    resultCount: events.length,
    timeRange: { start: timeMin, end: timeMax },
    events: events.map((event: any) => formatEvent(event)),
  };
}

async function executeGetEvent(calendar: any, params: Record<string, unknown>) {
  const calendarId = (params.calendarId as string) || 'primary';
  const eventId = params.eventId as string;

  const response = await calendar.events.get({
    calendarId,
    eventId,
  });

  return formatEvent(response.data);
}

async function executeCreateEvent(calendar: any, params: Record<string, unknown>) {
  const calendarId = (params.calendarId as string) || 'primary';

  // Build event resource
  const eventResource: any = {
    summary: params.summary as string,
  };

  if (params.description) {
    eventResource.description = params.description as string;
  }

  if (params.location) {
    eventResource.location = params.location as string;
  }

  // Handle date/time
  if (params.startDateTime && params.endDateTime) {
    // Timed event
    eventResource.start = {
      dateTime: params.startDateTime as string,
      timeZone: (params.timeZone as string) || undefined,
    };
    eventResource.end = {
      dateTime: params.endDateTime as string,
      timeZone: (params.timeZone as string) || undefined,
    };
  } else if (params.startDate) {
    // All-day event
    eventResource.start = {
      date: params.startDate as string,
    };
    eventResource.end = {
      date: (params.endDate as string) || params.startDate as string,
    };
  } else {
    // Default to 1 hour from now
    const startTime = new Date();
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);
    eventResource.start = { dateTime: startTime.toISOString() };
    eventResource.end = { dateTime: endTime.toISOString() };
  }

  // Handle attendees
  if (params.attendees && Array.isArray(params.attendees)) {
    eventResource.attendees = (params.attendees as string[]).map((email) => ({ email }));
  }

  // Handle reminders
  if (params.reminders && Array.isArray(params.reminders)) {
    eventResource.reminders = {
      useDefault: false,
      overrides: params.reminders,
    };
  }

  const sendUpdates = params.sendNotifications !== false ? 'all' : 'none';

  const response = await calendar.events.insert({
    calendarId,
    requestBody: eventResource,
    sendUpdates,
  });

  return {
    created: true,
    event: formatEvent(response.data),
  };
}

async function executeUpdateEvent(calendar: any, params: Record<string, unknown>) {
  const calendarId = (params.calendarId as string) || 'primary';
  const eventId = params.eventId as string;

  // First, get the existing event
  const existingResponse = await calendar.events.get({
    calendarId,
    eventId,
  });

  const existingEvent = existingResponse.data;

  // Build updated event resource (merge with existing)
  const eventResource: any = {
    ...existingEvent,
  };

  if (params.summary !== undefined) {
    eventResource.summary = params.summary as string;
  }

  if (params.description !== undefined) {
    eventResource.description = params.description as string;
  }

  if (params.location !== undefined) {
    eventResource.location = params.location as string;
  }

  // Handle date/time updates
  if (params.startDateTime && params.endDateTime) {
    eventResource.start = {
      dateTime: params.startDateTime as string,
      timeZone: (params.timeZone as string) || eventResource.start?.timeZone,
    };
    eventResource.end = {
      dateTime: params.endDateTime as string,
      timeZone: (params.timeZone as string) || eventResource.end?.timeZone,
    };
  } else if (params.startDate) {
    eventResource.start = { date: params.startDate as string };
    eventResource.end = { date: (params.endDate as string) || params.startDate as string };
  }

  // Handle attendees
  if (params.attendees !== undefined) {
    eventResource.attendees = (params.attendees as string[]).map((email) => ({ email }));
  }

  const sendUpdates = params.sendNotifications !== false ? 'all' : 'none';

  const response = await calendar.events.update({
    calendarId,
    eventId,
    requestBody: eventResource,
    sendUpdates,
  });

  return {
    updated: true,
    event: formatEvent(response.data),
  };
}

async function executeDeleteEvent(calendar: any, params: Record<string, unknown>) {
  const calendarId = (params.calendarId as string) || 'primary';
  const eventId = params.eventId as string;
  const sendUpdates = params.sendNotifications !== false ? 'all' : 'none';

  await calendar.events.delete({
    calendarId,
    eventId,
    sendUpdates,
  });

  return {
    deleted: true,
    eventId,
  };
}

async function executeListCalendars(calendar: any) {
  const response = await calendar.calendarList.list();
  const calendars = response.data.items || [];

  return {
    calendars: calendars.map((cal: any) => ({
      id: cal.id,
      summary: cal.summary,
      description: cal.description,
      timeZone: cal.timeZone,
      accessRole: cal.accessRole,
      primary: cal.primary || false,
      backgroundColor: cal.backgroundColor,
      foregroundColor: cal.foregroundColor,
    })),
  };
}

async function executeQuickAdd(calendar: any, params: Record<string, unknown>) {
  const calendarId = (params.calendarId as string) || 'primary';
  const text = params.text as string;
  const sendUpdates = params.sendNotifications !== false ? 'all' : 'none';

  const response = await calendar.events.quickAdd({
    calendarId,
    text,
    sendUpdates,
  });

  return {
    created: true,
    event: formatEvent(response.data),
  };
}

async function executeFindFreeTime(calendar: any, params: Record<string, unknown>) {
  const timeMin = params.timeMin as string;
  const timeMax = params.timeMax as string;
  const calendars = (params.calendars as string[]) || ['primary'];
  const timeZone = (params.timeZone as string) || 'UTC';

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin,
      timeMax,
      timeZone,
      items: calendars.map((id) => ({ id })),
    },
  });

  const busyTimes: any[] = [];
  const calendarResults = response.data.calendars || {};

  for (const calId of Object.keys(calendarResults)) {
    const calData = calendarResults[calId];
    if (calData.busy) {
      for (const busy of calData.busy) {
        busyTimes.push({
          calendarId: calId,
          start: busy.start,
          end: busy.end,
        });
      }
    }
  }

  // Sort busy times
  busyTimes.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Calculate free slots
  const freeSlots: any[] = [];
  let currentTime = new Date(timeMin);
  const endTime = new Date(timeMax);

  for (const busy of busyTimes) {
    const busyStart = new Date(busy.start);
    if (currentTime < busyStart) {
      freeSlots.push({
        start: currentTime.toISOString(),
        end: busyStart.toISOString(),
        durationMinutes: Math.round((busyStart.getTime() - currentTime.getTime()) / 60000),
      });
    }
    currentTime = new Date(Math.max(currentTime.getTime(), new Date(busy.end).getTime()));
  }

  // Add final free slot if there's time remaining
  if (currentTime < endTime) {
    freeSlots.push({
      start: currentTime.toISOString(),
      end: endTime.toISOString(),
      durationMinutes: Math.round((endTime.getTime() - currentTime.getTime()) / 60000),
    });
  }

  return {
    timeRange: { start: timeMin, end: timeMax },
    busySlots: busyTimes,
    freeSlots,
  };
}

// Helper function to format event response
function formatEvent(event: any): Partial<CalendarEvent> {
  return {
    id: event.id,
    calendarId: event.organizer?.email || 'primary',
    summary: event.summary || '(No title)',
    description: event.description,
    location: event.location,
    start: event.start,
    end: event.end,
    attendees: event.attendees?.map((a: any) => ({
      email: a.email,
      displayName: a.displayName,
      responseStatus: a.responseStatus,
      optional: a.optional,
    })),
    status: event.status,
    htmlLink: event.htmlLink,
    created: event.created,
    updated: event.updated,
    recurringEventId: event.recurringEventId,
    organizer: event.organizer,
  };
}
