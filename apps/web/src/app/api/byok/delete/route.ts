/**
 * BYOK Delete API Route
 *
 * DELETE /api/byok/delete?provider=openai
 * Removes a user's API key for a specific provider.
 * If no provider specified, removes all keys.
 *
 * SECURITY:
 * - Requires authentication
 * - Rate limited (strict: 3 requests/minute)
 * - Deletes key from Secret Manager
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { strictRatelimitAsync, rateLimitErrorResponse } from '@/lib/ratelimit';
import { deleteUserKey, deleteAllUserKeys, type BYOKProvider } from '@/lib/secretManager';
import { auditApiKey, auditSecurity, logAuditEvent } from '@/lib/auditLog';

const VALID_PROVIDERS: BYOKProvider[] = ['openai', 'claude', 'grok', 'gemini'];

export async function DELETE(request: Request) {
  try {
    // 1. Authenticate user
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authError || 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Rate limit (strict: 3 per minute) - uses Redis when available
    const rateLimitKey = `byok_delete_${user.id}`;
    const rateLimitResult = await strictRatelimitAsync(rateLimitKey);
    if (!rateLimitResult.success) {
      // Audit: Rate limit exceeded
      await auditSecurity.rateLimitExceeded(user.id, '/api/byok/delete', {
        headers: request.headers,
      });
      return NextResponse.json(rateLimitErrorResponse(rateLimitResult), { status: 429 });
    }

    // 3. Get provider from query params
    const { searchParams } = new URL(request.url);
    const provider = searchParams.get('provider');

    // 4. If no provider, delete all keys
    if (!provider) {
      try {
        await deleteAllUserKeys(user.id);
        // Audit: All API keys deleted (single event with all providers listed)
        await logAuditEvent("api_key", "api_key_deleted", {
          userId: user.id,
          request: { headers: request.headers },
          resourceType: "api_key",
          resourceId: "all",
          details: { providers: VALID_PROVIDERS, action: "delete_all" },
        });
        return NextResponse.json({
          success: true,
          message: 'All API keys have been removed',
        });
      } catch (error) {
        console.error('[BYOK Delete] Failed to delete all keys:', error instanceof Error ? error.message : 'Unknown error');
        return NextResponse.json(
          { error: 'Delete failed', message: 'Failed to remove API keys' },
          { status: 500 }
        );
      }
    }

    // 5. Validate provider
    if (!VALID_PROVIDERS.includes(provider as BYOKProvider)) {
      return NextResponse.json(
        {
          error: 'Invalid provider',
          message: `Provider must be one of: ${VALID_PROVIDERS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // 6. Delete specific provider key
    try {
      await deleteUserKey(user.id, provider as BYOKProvider);
      // Audit: API key deleted
      await auditApiKey.deleted(user.id, provider, { headers: request.headers });
      return NextResponse.json({
        success: true,
        message: `${provider.charAt(0).toUpperCase() + provider.slice(1)} API key has been removed`,
        provider,
      });
    } catch (error) {
      console.error('[BYOK Delete] Failed to delete key:', error instanceof Error ? error.message : 'Unknown error');
      return NextResponse.json(
        { error: 'Delete failed', message: 'Failed to remove API key' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[BYOK Delete] Unexpected error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal error', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
