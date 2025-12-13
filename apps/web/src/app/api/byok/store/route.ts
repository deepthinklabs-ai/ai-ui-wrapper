/**
 * BYOK Store API Route
 *
 * POST /api/byok/store
 * Stores a user's API key for a specific provider in Google Secret Manager.
 *
 * SECURITY:
 * - Requires authentication
 * - Rate limited (3 requests/minute)
 * - Validates key format
 * - Tests key before storing
 * - Never logs or returns the key
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { strictRatelimit, rateLimitErrorResponse } from '@/lib/ratelimit';
import { updateUserKey, type BYOKProvider } from '@/lib/secretManager';
import { validateKeyFormat, testApiKey } from '@/lib/secretManager/validation';

const VALID_PROVIDERS: BYOKProvider[] = ['openai', 'claude', 'grok', 'gemini'];

export async function POST(request: Request) {
  try {
    // 1. Authenticate user
    const { user, error: authError } = await getAuthenticatedUser(request);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', message: authError || 'Authentication required' },
        { status: 401 }
      );
    }

    // 2. Rate limit (strict: 3 per minute)
    const rateLimitKey = `byok_store_${user.id}`;
    const rateLimitResult = strictRatelimit(rateLimitKey);
    if (!rateLimitResult.success) {
      return NextResponse.json(rateLimitErrorResponse(rateLimitResult), { status: 429 });
    }

    // 3. Parse request body
    let body: { provider?: string; apiKey?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid request', message: 'Request body must be valid JSON' },
        { status: 400 }
      );
    }

    const { provider, apiKey } = body;

    // 4. Validate provider
    if (!provider || !VALID_PROVIDERS.includes(provider as BYOKProvider)) {
      return NextResponse.json(
        {
          error: 'Invalid provider',
          message: `Provider must be one of: ${VALID_PROVIDERS.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // 5. Validate API key exists
    if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
      return NextResponse.json(
        { error: 'Invalid API key', message: 'API key is required' },
        { status: 400 }
      );
    }

    const trimmedKey = apiKey.trim();
    const providerType = provider as BYOKProvider;

    // 6. Validate key format
    const formatValidation = validateKeyFormat(providerType, trimmedKey);
    if (!formatValidation.valid) {
      return NextResponse.json(
        { error: 'Invalid API key format', message: formatValidation.error },
        { status: 400 }
      );
    }

    // 7. Test the API key with provider
    const testResult = await testApiKey(providerType, trimmedKey);
    if (!testResult.success) {
      return NextResponse.json(
        {
          error: 'API key validation failed',
          message: testResult.error || 'The API key could not be validated',
        },
        { status: 400 }
      );
    }

    // 8. Store the key in Secret Manager
    try {
      console.log('[BYOK Store] Attempting to store key for user:', user.id, 'provider:', providerType);
      await updateUserKey(user.id, providerType, trimmedKey);
      console.log('[BYOK Store] Successfully stored key for user:', user.id);
    } catch (storeError) {
      // Log full error details for debugging
      const errorMessage = storeError instanceof Error ? storeError.message : 'Unknown error';
      const errorStack = storeError instanceof Error ? storeError.stack : '';
      console.error('[BYOK Store] Failed to store key:', errorMessage);
      console.error('[BYOK Store] Error stack:', errorStack);
      console.error('[BYOK Store] Full error:', JSON.stringify(storeError, Object.getOwnPropertyNames(storeError as object), 2));

      return NextResponse.json(
        { error: 'Storage failed', message: 'Failed to store API key. Please try again.' },
        { status: 500 }
      );
    }

    // 9. Return success (never return the key)
    return NextResponse.json({
      success: true,
      message: `${providerType.charAt(0).toUpperCase() + providerType.slice(1)} API key saved successfully`,
      provider: providerType,
    });
  } catch (error) {
    console.error('[BYOK Store] Unexpected error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal error', message: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
