/**
 * Google OAuth 2.0 Configuration
 * Handles authentication for Gmail, Drive, Sheets, and Docs
 */

// Helper to get app URL for Google OAuth
// Google OAuth works with localhost, so always use localhost:3000 in development
// In production, use the configured APP_URL
const getAppUrl = () => {
  // Production: use configured URL
  if (process.env.NODE_ENV === 'production') {
    return process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  }
  // Development: Google OAuth allows localhost, so always use it
  // This avoids issues with dynamic tunnel URLs
  return 'http://localhost:3000';
};

// Helper to get redirect URI dynamically at runtime
export const getRedirectUri = () => `${getAppUrl()}/api/oauth/google/callback`;

export const GOOGLE_OAUTH_CONFIG = {
  clientId: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET || '',
  // NOTE: redirectUri is now dynamic - use getRedirectUri() instead of this property
  get redirectUri() { return getRedirectUri(); },

  // All available scopes for different Google services
  scopes: [
    // Gmail scopes
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.modify',

    // Google Drive scopes
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.readonly',

    // Google Sheets scopes
    'https://www.googleapis.com/auth/spreadsheets',

    // Google Docs scopes
    'https://www.googleapis.com/auth/documents',

    // Google Calendar scopes
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',

    // User profile (for identification)
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ],

  // Service-specific scope groups
  scopeGroups: {
    gmail: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    calendar: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    sheets: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
    docs: [
      'https://www.googleapis.com/auth/documents',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
  } as Record<string, string[]>,

  // Authorization endpoint
  authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth',

  // Token endpoint
  tokenUrl: 'https://oauth2.googleapis.com/token',

  // Revoke endpoint
  revokeUrl: 'https://oauth2.googleapis.com/revoke',
};

export type GoogleOAuthTokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  id_token?: string;
};

export type GoogleUserInfo = {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
};

/**
 * Generate Google OAuth authorization URL
 * @param state - CSRF state token
 * @param service - Optional service name ('gmail', 'calendar', 'sheets', 'docs') to request only that service's scopes
 */
export function getGoogleAuthUrl(state: string, service?: string): string {
  const redirectUri = getRedirectUri();
  console.log('[Google OAuth] getGoogleAuthUrl - redirect_uri:', redirectUri, 'service:', service);

  // Use service-specific scopes if provided, otherwise all scopes
  const scopes = service && GOOGLE_OAUTH_CONFIG.scopeGroups[service]
    ? GOOGLE_OAUTH_CONFIG.scopeGroups[service]
    : GOOGLE_OAUTH_CONFIG.scopes;

  const params = new URLSearchParams({
    client_id: GOOGLE_OAUTH_CONFIG.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes.join(' '),
    access_type: 'offline', // Get refresh token
    prompt: 'consent', // Force consent to get refresh token
    state,
  });

  return `${GOOGLE_OAUTH_CONFIG.authorizationUrl}?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string): Promise<GoogleOAuthTokens> {
  const response = await fetch(GOOGLE_OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_OAUTH_CONFIG.clientId,
      client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
      redirect_uri: GOOGLE_OAUTH_CONFIG.redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${error}`);
  }

  return response.json();
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string): Promise<GoogleOAuthTokens> {
  const response = await fetch(GOOGLE_OAUTH_CONFIG.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: GOOGLE_OAUTH_CONFIG.clientId,
      client_secret: GOOGLE_OAUTH_CONFIG.clientSecret,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to refresh access token: ${error}`);
  }

  return response.json();
}

/**
 * Revoke Google OAuth token
 */
export async function revokeGoogleToken(token: string): Promise<void> {
  const response = await fetch(GOOGLE_OAUTH_CONFIG.revokeUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      token,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to revoke token: ${error}`);
  }
}

/**
 * Get user info from Google
 */
export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get user info: ${error}`);
  }

  return response.json();
}
