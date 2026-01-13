/**
 * SSM Event Fetching
 *
 * Fetches events from Gmail and Calendar data sources.
 * Used by both cron job and manual poll operations.
 *
 * Security:
 * - No plaintext logging of email content or event details
 * - Only log counts and errors
 */

import { getGmailClient, getCalendarClient } from '@/lib/googleClients';
import type { SSMEvent } from '@/app/canvas/types/ssm';
import type { SSMPollingSettings } from '@/lib/ssmServerConfig/types';
import type { FetchEventsResult } from './types';

/**
 * Fetch emails from Gmail
 *
 * @param userId - User ID for OAuth token lookup
 * @param settings - Polling settings with Gmail config
 * @param lastEventAt - Optional timestamp to fetch emails after
 * @returns Fetched events and any errors
 */
export async function fetchGmailEvents(
  userId: string,
  settings: SSMPollingSettings,
  lastEventAt?: string
): Promise<FetchEventsResult> {
  const events: SSMEvent[] = [];

  if (!settings.gmail_enabled) {
    return { events };
  }

  try {
    const gmail = await getGmailClient(userId);

    // Build Gmail query
    let query = 'is:unread';

    // Get emails from last poll or last hour
    const sinceDate = lastEventAt
      ? new Date(lastEventAt)
      : new Date(Date.now() - 60 * 60 * 1000);
    query += ` after:${Math.floor(sinceDate.getTime() / 1000)}`;

    // Search for emails
    const listResponse = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 50,
    });

    const messages = listResponse.data.messages || [];

    // Fetch full content for each message
    for (const msg of messages) {
      if (!msg.id) continue;

      const fullMessage = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full',
      });

      // Extract headers
      const headers = fullMessage.data.payload?.headers || [];
      const getHeader = (name: string) =>
        headers.find(h => h.name?.toLowerCase() === name.toLowerCase())?.value || '';

      const from = getHeader('From');
      const subject = getHeader('Subject');
      const date = getHeader('Date');

      // Extract body
      let body = '';
      const payload = fullMessage.data.payload;
      if (payload?.body?.data) {
        body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
      } else if (payload?.parts) {
        // Multi-part email
        for (const part of payload.parts) {
          if (part.mimeType === 'text/plain' && part.body?.data) {
            body = Buffer.from(part.body.data, 'base64').toString('utf-8');
            break;
          }
        }
      }

      // Create event
      const event: SSMEvent = {
        id: msg.id,
        timestamp: date || new Date().toISOString(),
        source: 'gmail',
        type: 'email',
        content: `From: ${from}\nSubject: ${subject}\n\n${body}`,
        metadata: {
          from,
          subject,
          date,
          messageId: msg.id,
          threadId: fullMessage.data.threadId,
        },
      };

      events.push(event);
    }

    // Log count only (no content)
    console.log(`[SSM Polling] Fetched ${events.length} Gmail events`);

    return { events };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SSM Polling] Gmail fetch error:', errorMsg);
    return { events, error: `Gmail fetch failed: ${errorMsg}` };
  }
}

/**
 * Fetch events from Google Calendar
 *
 * @param userId - User ID for OAuth token lookup
 * @param settings - Polling settings with Calendar config
 * @returns Fetched events and any errors
 */
export async function fetchCalendarEvents(
  userId: string,
  settings: SSMPollingSettings
): Promise<FetchEventsResult> {
  const events: SSMEvent[] = [];

  if (!settings.calendar_enabled) {
    return { events };
  }

  try {
    const calendar = await getCalendarClient(userId);

    // Get events from the last hour (to catch recently created events)
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // List events that were created or updated recently
    const listResponse = await calendar.events.list({
      calendarId: 'primary',
      updatedMin: oneHourAgo.toISOString(),
      maxResults: 50,
      singleEvents: true,
      orderBy: 'updated',
    });

    const calendarEvents = listResponse.data.items || [];

    for (const calEvent of calendarEvents) {
      if (!calEvent.id) continue;

      // Get event start time
      const startTime = calEvent.start?.dateTime || calEvent.start?.date || '';
      const endTime = calEvent.end?.dateTime || calEvent.end?.date || '';

      // Build attendee list
      const attendees = calEvent.attendees
        ?.map(a => a.email || a.displayName)
        .filter(Boolean)
        .join(', ') || 'None';

      // Create event content for rules matching
      const content = `
Calendar Event: ${calEvent.summary || 'No title'}
Start: ${startTime}
End: ${endTime}
Location: ${calEvent.location || 'Not specified'}
Description: ${calEvent.description || 'No description'}
Attendees: ${attendees}
Organizer: ${calEvent.organizer?.email || 'Unknown'}
Status: ${calEvent.status || 'Unknown'}
      `.trim();

      const event: SSMEvent = {
        id: `cal_${calEvent.id}`,
        timestamp: calEvent.updated || calEvent.created || now.toISOString(),
        source: 'calendar',
        type: 'calendar_event',
        content,
        metadata: {
          eventId: calEvent.id,
          summary: calEvent.summary,
          start: startTime,
          end: endTime,
          location: calEvent.location,
          description: calEvent.description,
          attendees: calEvent.attendees?.map(a => a.email).filter(Boolean),
          organizer: calEvent.organizer?.email,
          status: calEvent.status,
          htmlLink: calEvent.htmlLink,
          created: calEvent.created,
          updated: calEvent.updated,
        },
      };

      events.push(event);
    }

    // Log count only (no content)
    console.log(`[SSM Polling] Fetched ${events.length} calendar events`);

    return { events };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[SSM Polling] Calendar fetch error:', errorMsg);
    return { events, error: `Calendar fetch failed: ${errorMsg}` };
  }
}

/**
 * Fetch events from all configured data sources
 *
 * @param userId - User ID for OAuth token lookup
 * @param settings - Polling settings
 * @param lastEventAt - Optional timestamp to fetch events after
 * @returns Combined events from all sources
 */
export async function fetchAllEvents(
  userId: string,
  settings: SSMPollingSettings,
  lastEventAt?: string
): Promise<FetchEventsResult> {
  const allEvents: SSMEvent[] = [];
  const errors: string[] = [];

  // Fetch from Gmail
  if (settings.gmail_enabled) {
    const gmailResult = await fetchGmailEvents(userId, settings, lastEventAt);
    allEvents.push(...gmailResult.events);
    if (gmailResult.error) {
      errors.push(gmailResult.error);
    }
  }

  // Fetch from Calendar
  if (settings.calendar_enabled) {
    const calendarResult = await fetchCalendarEvents(userId, settings);
    allEvents.push(...calendarResult.events);
    if (calendarResult.error) {
      errors.push(calendarResult.error);
    }
  }

  return {
    events: allEvents,
    error: errors.length > 0 ? errors.join('; ') : undefined,
  };
}
