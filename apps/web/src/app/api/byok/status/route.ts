/**
 * BYOK Status API Route
 *
 * GET /api/byok/status
 * Returns which providers have API keys configured for the user.
 * Includes key rotation status and warnings for security best practices.
 * Never returns the actual keys, only boolean status and metadata.
 *
 * SECURITY:
 * - Requires authentication
 * - Rate limited (lenient: 30 requests/10s)
 * - Only returns boolean values and timestamps, never keys
 */

import { NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { lenientRatelimitAsync, rateLimitErrorResponse } from '@/lib/ratelimit';
import { getUserKeyStatus, hasAnyKey, getKeyRotationStatus, getProvidersNeedingRotation } from '@/lib/secretManager';
import { auditApiKey } from '@/lib/auditLog';

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

    // 2. Rate limit (lenient for read operations) - uses Redis when available
    const rateLimitKey = `byok_status_${user.id}`;
    const rateLimitResult = await lenientRatelimitAsync(rateLimitKey);
    if (!rateLimitResult.success) {
      return NextResponse.json(rateLimitErrorResponse(rateLimitResult), { status: 429 });
    }

    // 3. Get key status from Secret Manager
    const status = await getUserKeyStatus(user.id);
    const hasKeys = await hasAnyKey(user.id);

    // 4. Get key rotation status
    const rotationStatus = await getKeyRotationStatus(user.id);

    // 5. Log rotation warning if any keys need rotation (once per status check)
    if (rotationStatus.anyKeyNeedsRotation) {
      const providersNeedingRotation = await getProvidersNeedingRotation(user.id);
      const ageInDays: Record<string, number | null> = {};
      providersNeedingRotation.forEach((provider) => {
        ageInDays[provider] = rotationStatus[provider].ageInDays;
      });
      // Log warning (non-blocking)
      auditApiKey.rotationWarning(user.id, providersNeedingRotation, { ageInDays }).catch(() => {
        // Ignore audit log failures - don't block the response
      });
    }

    // 6. Return status with rotation info (never actual keys)
    return NextResponse.json({
      // Key presence status
      openai: status.openai,
      claude: status.claude,
      grok: status.grok,
      gemini: status.gemini,
      hasAnyKey: hasKeys,
      // Key rotation status
      rotation: {
        openai: status.openai ? {
          ageInDays: rotationStatus.openai.ageInDays,
          needsRotation: rotationStatus.openai.needsRotation,
          warningDue: rotationStatus.openai.warningDue,
          daysUntilRotation: rotationStatus.openai.daysUntilRotation,
        } : null,
        claude: status.claude ? {
          ageInDays: rotationStatus.claude.ageInDays,
          needsRotation: rotationStatus.claude.needsRotation,
          warningDue: rotationStatus.claude.warningDue,
          daysUntilRotation: rotationStatus.claude.daysUntilRotation,
        } : null,
        grok: status.grok ? {
          ageInDays: rotationStatus.grok.ageInDays,
          needsRotation: rotationStatus.grok.needsRotation,
          warningDue: rotationStatus.grok.warningDue,
          daysUntilRotation: rotationStatus.grok.daysUntilRotation,
        } : null,
        gemini: status.gemini ? {
          ageInDays: rotationStatus.gemini.ageInDays,
          needsRotation: rotationStatus.gemini.needsRotation,
          warningDue: rotationStatus.gemini.warningDue,
          daysUntilRotation: rotationStatus.gemini.daysUntilRotation,
        } : null,
        anyKeyNeedsRotation: rotationStatus.anyKeyNeedsRotation,
        anyWarningDue: rotationStatus.anyWarningDue,
      },
    });
  } catch (error) {
    console.error('[BYOK Status] Error:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Internal error', message: 'Failed to retrieve key status' },
      { status: 500 }
    );
  }
}
