# Authentication Fix - Supabase Auth Integration

## Issue
The security implementation initially used NextAuth (`next-auth`) but this project uses **Supabase Auth**.

## What Was Fixed

### Files Created:
1. **`src/lib/serverAuth.ts`** - Server-side authentication helper
   - `getAuthenticatedUser(request)` - Extracts and verifies Supabase user from Bearer token
   - `getAuthenticatedSupabaseClient(request)` - Returns authenticated Supabase client

### Files Updated:
1. **`src/app/api/mcp/stdio/route.ts`**
   - Changed from: `getServerSession(authOptions)`
   - Changed to: `getAuthenticatedUser(request)`
   - Now uses Supabase user ID instead of email

2. **`src/app/api/mcp/credentials/route.ts`**
   - Updated all endpoints (GET, POST, PUT, DELETE)
   - Changed from: `getServerSession(authOptions)`
   - Changed to: `getAuthenticatedSupabaseClient(request)`
   - Removed lookups to `users` table by email
   - Now uses Supabase `user.id` directly

## How Authentication Works Now

### API Route Protection:
```typescript
// Get authenticated user from Authorization header
const authResult = await getAuthenticatedUser(request);

if (authResult.error || !authResult.user) {
  return NextResponse.json(
    { error: "Unauthorized" },
    { status: 401 }
  );
}

const userId = authResult.user.id; // Supabase user ID
```

### Frontend Requirements:
The frontend needs to send the Supabase session token in the Authorization header:

```typescript
const { data: { session } } = await supabase.auth.getSession();

fetch('/api/mcp/stdio', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}` // ← Required!
  },
  body: JSON.stringify({...})
});
```

## Current Status

✅ **Backend**: Fully updated and compiling
❌ **Frontend**: Still needs update to send auth headers

### What Happens Now:
- MCP API routes return `401 Unauthorized` without proper auth header
- This is **expected and correct** - it means security is working!
- Frontend needs to be updated to include `Authorization: Bearer <token>`

## Next Steps

The frontend MCP client (`src/lib/mcpClient.ts`) needs to be updated to:
1. Get Supabase session
2. Extract `access_token`
3. Include in all API requests as `Authorization: Bearer <token>`

This will be done after completing the database migration.

## Security Benefits

✅ Uses existing Supabase authentication
✅ No additional auth library needed
✅ Consistent with rest of application
✅ RLS (Row Level Security) compatible
✅ Proper user scoping with Supabase user IDs

---

**Status**: ✅ Backend authentication fixed and working
**Next**: Complete database migration, then update frontend auth headers
