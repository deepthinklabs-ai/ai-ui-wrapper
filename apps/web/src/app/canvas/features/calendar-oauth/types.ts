/**
 * Calendar OAuth Feature Types
 *
 * Type definitions for Google Calendar OAuth integration in Genesis Bot nodes.
 * Segmented from main canvas types for feature isolation.
 */

// Calendar OAuth connection status
export type CalendarConnectionStatus = 'disconnected' | 'connected' | 'expired' | 'error';

// Calendar permissions that can be granted to a Genesis Bot
export interface CalendarPermissions {
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canManageReminders: boolean;
}

// Calendar OAuth configuration stored in Genesis Bot node config
export interface CalendarOAuthConfig {
  enabled: boolean;
  connectionId?: string; // References oauth_connections table
  permissions: CalendarPermissions;
  // Optional restrictions
  defaultCalendarId?: string; // Default calendar to use (if not specified, uses 'primary')
  maxEventsPerDay?: number; // Rate limiting
  requireConfirmation?: boolean; // Require user confirmation before creating/updating
}

// Default Calendar permissions (conservative by default)
export const DEFAULT_CALENDAR_PERMISSIONS: CalendarPermissions = {
  canRead: true,
  canCreate: false, // Disabled by default for safety
  canUpdate: false,
  canDelete: false,
  canManageReminders: true,
};

// Default Calendar OAuth config
export const DEFAULT_CALENDAR_CONFIG: CalendarOAuthConfig = {
  enabled: false,
  permissions: DEFAULT_CALENDAR_PERMISSIONS,
  requireConfirmation: true,
  maxEventsPerDay: 20,
};

// Calendar connection info (from oauth_connections table)
export interface CalendarConnectionInfo {
  id: string;
  email: string;
  name: string;
  picture?: string;
  status: CalendarConnectionStatus;
  connectedAt: string;
  lastUsedAt?: string;
  scopes: string[];
}

// Calendar tool definitions for AI
export interface CalendarToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  requiredPermission: keyof CalendarPermissions;
}

// Calendar event structure
export interface CalendarEvent {
  id: string;
  calendarId: string;
  summary: string;
  description?: string;
  location?: string;
  start: EventDateTime;
  end: EventDateTime;
  attendees?: EventAttendee[];
  reminders?: EventReminders;
  status: 'confirmed' | 'tentative' | 'cancelled';
  htmlLink?: string;
  created?: string;
  updated?: string;
  recurringEventId?: string;
  organizer?: {
    email: string;
    displayName?: string;
    self?: boolean;
  };
}

// Event date/time (supports both date-only and datetime)
export interface EventDateTime {
  date?: string; // For all-day events (YYYY-MM-DD)
  dateTime?: string; // For timed events (ISO 8601)
  timeZone?: string;
}

// Event attendee
export interface EventAttendee {
  email: string;
  displayName?: string;
  responseStatus?: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  optional?: boolean;
}

// Event reminders
export interface EventReminders {
  useDefault: boolean;
  overrides?: {
    method: 'email' | 'popup';
    minutes: number;
  }[];
}

// Calendar info
export interface CalendarInfo {
  id: string;
  summary: string;
  description?: string;
  timeZone?: string;
  accessRole: 'freeBusyReader' | 'reader' | 'writer' | 'owner';
  primary?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
}

// Create event parameters
export interface CreateEventParams {
  calendarId?: string;
  summary: string;
  description?: string;
  location?: string;
  startDateTime?: string; // ISO 8601 for timed events
  endDateTime?: string;
  startDate?: string; // YYYY-MM-DD for all-day events
  endDate?: string;
  timeZone?: string;
  attendees?: string[]; // Email addresses
  sendNotifications?: boolean;
  reminders?: {
    method: 'email' | 'popup';
    minutes: number;
  }[];
}

// Update event parameters
export interface UpdateEventParams {
  calendarId?: string;
  eventId: string;
  summary?: string;
  description?: string;
  location?: string;
  startDateTime?: string;
  endDateTime?: string;
  startDate?: string;
  endDate?: string;
  timeZone?: string;
  attendees?: string[];
  sendNotifications?: boolean;
}

// List events parameters
export interface ListEventsParams {
  calendarId?: string;
  timeMin?: string; // ISO 8601
  timeMax?: string;
  maxResults?: number;
  query?: string; // Free text search
  singleEvents?: boolean; // Expand recurring events
  orderBy?: 'startTime' | 'updated';
}

// API response types
export interface CalendarOperationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  requiresConfirmation?: boolean;
  confirmationId?: string;
}

// Pending event confirmation (for requireConfirmation feature)
export interface PendingEventConfirmation {
  id: string;
  nodeId: string;
  event: CreateEventParams;
  createdAt: string;
  expiresAt: string;
}
