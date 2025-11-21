# Google OAuth 2.0 Integration Guide

## Overview

This document outlines the complete Google OAuth 2.0 integration for The Workforce feature, allowing virtual employees to access Gmail, Google Drive, Google Sheets, and Google Docs.

## Setup Steps

### 1. Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Gmail API
   - Google Drive API
   - Google Sheets API
   - Google Docs API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Configure OAuth consent screen
6. Create OAuth 2.0 Client ID (Web application)
7. Add authorized redirect URIs:
   - `http://localhost:3000/api/oauth/google/callback` (development)
   - `https://yourdomain.com/api/oauth/google/callback` (production)
8. Copy Client ID and Client Secret

### 2. Environment Variables

Add to `.env.local`:

```env
# Google OAuth
GOOGLE_OAUTH_CLIENT_ID=your_client_id_here
GOOGLE_OAUTH_CLIENT_SECRET=your_client_secret_here
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Supabase Service Role Key (for server-side operations)
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Encryption key for token storage (generate with: openssl rand -base64 32)
OAUTH_ENCRYPTION_KEY=your_32_byte_encryption_key_here
```

### 3. Database Migration

Run the migration file `008_google_oauth_tokens.sql` in your Supabase SQL Editor.

Additionally, create the oauth_states table for CSRF protection:

```sql
CREATE TABLE IF NOT EXISTS oauth_states (
  state TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);

ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own OAuth states" ON oauth_states
  FOR ALL USING (auth.uid() = user_id);
```

### 4. Install Required Packages

```bash
npm install googleapis @google-cloud/local-auth crypto-js
npm install --save-dev @types/crypto-js
```

## File Structure

```
src/
├── app/
│   ├── api/
│   │   └── oauth/
│   │       └── google/
│   │           ├── authorize/
│   │           │   └── route.ts          # Start OAuth flow
│   │           ├── callback/
│   │           │   └── route.ts          # Handle OAuth callback
│   │           └── revoke/
│   │               └── route.ts          # Revoke access
│   └── tools/
│       └── page.tsx                      # Tools/Integrations UI
├── lib/
│   ├── googleOAuth.ts                    # OAuth configuration
│   ├── googleTokenStorage.ts             # Secure token storage
│   └── googleClients.ts                  # Authenticated API clients
└── hooks/
    └── useGoogleOAuth.ts                 # React hook for OAuth flow
```

## Implementation Files

### Already Created:
- ✅ `src/lib/googleOAuth.ts` - OAuth configuration and helpers
- ✅ `database-migrations/008_google_oauth_tokens.sql` - Database schema
- ✅ `src/app/api/oauth/google/authorize/route.ts` - Authorization endpoint

### Still Needed:
The implementation is quite extensive. Here's what still needs to be created:

1. **OAuth Callback Route** (`src/app/api/oauth/google/callback/route.ts`)
   - Handles the redirect from Google
   - Exchanges auth code for tokens
   - Encrypts and stores tokens in database
   - Gets user info from Google
   - Redirects back to tools page

2. **OAuth Revoke Route** (`src/app/api/oauth/google/revoke/route.ts`)
   - Revokes Google OAuth token
   - Deletes connection from database
   - Removes employee access grants

3. **Token Storage Library** (`src/lib/googleTokenStorage.ts`)
   - Encrypts/decrypts tokens using AES-256
   - Stores tokens in database
   - Retrieves and refreshes expired tokens
   - Handles token expiration logic

4. **Google API Clients** (`src/lib/googleClients.ts`)
   - `getGmailClient(userId)` - Returns authenticated Gmail client
   - `getDriveClient(userId)` - Returns authenticated Drive client
   - `getSheetsClient(userId)` - Returns authenticated Sheets client
   - `getDocsClient(userId)` - Returns authenticated Docs client
   - Automatically refreshes tokens if expired

5. **React Hook** (`src/hooks/useGoogleOAuth.ts`)
   - `useGoogleOAuth()` hook for UI components
   - Methods: `connect()`, `disconnect()`, `isConnected`, `connectionStatus`

6. **Tools Page** (`src/app/tools/page.tsx`)
   - UI for managing integrations
   - Connect/Disconnect Google account
   - Shows connected status
   - Lists available services

7. **Employee Tool Access** (Workforce integration)
   - UI to grant/revoke tool access per employee
   - Update employee cards to show tool access
   - Integration with training/instruction sessions

## Usage Examples

### Frontend - Connect Google Account

```typescript
import { useGoogleOAuth } from '@/hooks/useGoogleOAuth';

function ToolsPage() {
  const { isConnected, connect, disconnect } = useGoogleOAuth();

  return (
    <div>
      {!isConnected ? (
        <button onClick={connect}>Connect Google Account</button>
      ) : (
        <button onClick={disconnect}>Disconnect Google</button>
      )}
    </div>
  );
}
```

### Backend - Use Gmail Client

```typescript
import { getGmailClient } from '@/lib/googleClients';

// In an API route or server component
const gmail = await getGmailClient(userId);

// Send email
await gmail.users.messages.send({
  userId: 'me',
  requestBody: {
    raw: base64EncodedEmail,
  },
});
```

### Grant Employee Access

```typescript
import { supabase } from '@/lib/supabaseClient';

// Grant Gmail and Drive access to an employee
await supabase.from('employee_oauth_access').insert({
  virtual_employee_id: employeeId,
  oauth_connection_id: connectionId,
  allowed_services: ['gmail', 'drive'],
  granted_by: userId,
});
```

## Security Considerations

1. **Token Encryption**: All access and refresh tokens are encrypted using AES-256 before storage
2. **CSRF Protection**: State parameter validation prevents CSRF attacks
3. **Scope Limitation**: Only request necessary scopes
4. **Token Refresh**: Automatically refresh expired tokens
5. **RLS Policies**: Database-level security ensures users only access their own data
6. **Service Role Key**: Server-side operations use Supabase service role key

## Next Steps

Would you like me to:
1. Create all the remaining implementation files?
2. Focus on a specific part (e.g., just the callback route and token storage)?
3. Create the Tools UI page first?
4. Add employee tool access management to the Workforce feature?

Let me know which approach you'd prefer!
