/**
 * BYOK Status API Route
 *
 * GET /api/byok/status
 * Returns which providers have API keys configured for the user.
 * Never returns the actual keys, only boolean status.
 *
 * SECURITY:
 * - Requires authentication
 * - Rate limited (lenient: 30 requests/10s)
 * - Only returns boolean values, never keys
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { lenientRatelimit, rateLimitErrorResponse } from '@/lib/ratelimit';
import { getUserKeyStatus, hasAnyKey } from '@/lib/secretManager';

export async function GET(request: Request) {
  try {
    // 1. Authenticate user
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authError || 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Rate limit (lenient for read operations)
    const rateLimitKey = `byok_status_${user.id}`;
    const rateLimitResult = lenientRatelimit(rateLimitKey);
    if (!rateLimitResult.success) {
      return NextResponse.json(rateLimitErrorResponse(rateLimitResult), { status: 429 });
    }

    // 3. Get key status from Secret Manager
    const status = await getUserKeyStatus(user.id);
    const hasKeys = await hasAnyKey(user.id);

    // 4. Return status (never actual keys)
    return NextResponse.json({
      openai: status.openai,
      claude: status.claude,
      grok: status.grok,
      gemini: status.gemini,
      hasAnyKey: hasKeys,
    });
  } catch (error) {
    console.error('[BYOK Status] Error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal error', message: 'Failed to retrieve key status' },
      { status: 500 }
    );
  }
}
