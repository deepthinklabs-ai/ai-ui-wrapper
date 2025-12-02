/**
 * Google API Authenticated Clients
 * Provides authenticated clients for Gmail, Drive, Sheets, and Docs
 * Portable across all pages - can be used anywhere in the app
 */

import { google } from 'googleapis';
import { getValidAccessToken, updateLastUsed, getOAuthConnection } from './googleTokenStorage';
import { GOOGLE_OAUTH_CONFIG } from './googleOAuth';

/**
 * Get authenticated Gmail client
 * Usage: const gmail = await getGmailClient(userId);
 */
export async function getGmailClient(userId: string) {
  const accessToken = await getValidAccessToken(userId, 'google');

  if (!accessToken) {
    throw new Error('No valid Google OAuth connection found. Please connect your Google account.');
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_OAUTH_CONFIG.clientId,
    GOOGLE_OAUTH_CONFIG.clientSecret,
    GOOGLE_OAUTH_CONFIG.redirectUri
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  // Update last used timestamp
  const connection = await getOAuthConnection(userId, 'google');
  if (connection) {
    await updateLastUsed(connection.id);
  }

  return google.gmail({ version: 'v1', auth: oauth2Client });
}

/**
 * Get authenticated Google Drive client
 * Usage: const drive = await getDriveClient(userId);
 */
export async function getDriveClient(userId: string) {
  const accessToken = await getValidAccessToken(userId, 'google');

  if (!accessToken) {
    throw new Error('No valid Google OAuth connection found. Please connect your Google account.');
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_OAUTH_CONFIG.clientId,
    GOOGLE_OAUTH_CONFIG.clientSecret,
    GOOGLE_OAUTH_CONFIG.redirectUri
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  // Update last used timestamp
  const connection = await getOAuthConnection(userId, 'google');
  if (connection) {
    await updateLastUsed(connection.id);
  }

  return google.drive({ version: 'v3', auth: oauth2Client });
}

/**
 * Get authenticated Google Sheets client
 * Usage: const sheets = await getSheetsClient(userId);
 */
export async function getSheetsClient(userId: string) {
  const accessToken = await getValidAccessToken(userId, 'google');

  if (!accessToken) {
    throw new Error('No valid Google OAuth connection found. Please connect your Google account.');
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_OAUTH_CONFIG.clientId,
    GOOGLE_OAUTH_CONFIG.clientSecret,
    GOOGLE_OAUTH_CONFIG.redirectUri
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  // Update last used timestamp
  const connection = await getOAuthConnection(userId, 'google');
  if (connection) {
    await updateLastUsed(connection.id);
  }

  return google.sheets({ version: 'v4', auth: oauth2Client });
}

/**
 * Get authenticated Google Docs client
 * Usage: const docs = await getDocsClient(userId);
 */
export async function getDocsClient(userId: string) {
  const accessToken = await getValidAccessToken(userId, 'google');

  if (!accessToken) {
    throw new Error('No valid Google OAuth connection found. Please connect your Google account.');
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_OAUTH_CONFIG.clientId,
    GOOGLE_OAUTH_CONFIG.clientSecret,
    GOOGLE_OAUTH_CONFIG.redirectUri
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  // Update last used timestamp
  const connection = await getOAuthConnection(userId, 'google');
  if (connection) {
    await updateLastUsed(connection.id);
  }

  return google.docs({ version: 'v1', auth: oauth2Client });
}

/**
 * Get authenticated Google Calendar client
 * Usage: const calendar = await getCalendarClient(userId);
 */
export async function getCalendarClient(userId: string) {
  const accessToken = await getValidAccessToken(userId, 'google');

  if (!accessToken) {
    throw new Error('No valid Google OAuth connection found. Please connect your Google account.');
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_OAUTH_CONFIG.clientId,
    GOOGLE_OAUTH_CONFIG.clientSecret,
    GOOGLE_OAUTH_CONFIG.redirectUri
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
  });

  // Update last used timestamp
  const connection = await getOAuthConnection(userId, 'google');
  if (connection) {
    await updateLastUsed(connection.id);
  }

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Check if user has Google OAuth connection
 */
export async function hasGoogleConnection(userId: string): Promise<boolean> {
  const connection = await getOAuthConnection(userId, 'google');
  return !!connection;
}

/**
 * Get all Google services the user has access to
 */
export async function getAvailableGoogleServices(userId: string): Promise<string[]> {
  const connection = await getOAuthConnection(userId, 'google');

  if (!connection) {
    return [];
  }

  const services: string[] = [];
  const scopes = connection.scopes;

  // Check which services are available based on granted scopes
  if (scopes.some(s => s.includes('gmail'))) {
    services.push('gmail');
  }
  if (scopes.some(s => s.includes('drive'))) {
    services.push('drive');
  }
  if (scopes.some(s => s.includes('spreadsheets'))) {
    services.push('sheets');
  }
  if (scopes.some(s => s.includes('documents'))) {
    services.push('docs');
  }
  if (scopes.some(s => s.includes('calendar'))) {
    services.push('calendar');
  }

  return services;
}
