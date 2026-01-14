/**
 * System Status API
 *
 * Returns the status of various system features (kill switches).
 * This endpoint is public so clients can check before attempting operations.
 */

import { NextResponse } from 'next/server';
import {
  isSignupEnabled,
  isOAuthEnabled,
  isPaymentsEnabled,
  isAIEnabled,
} from '@/lib/killSwitches';
import { withDebug } from '@/lib/debug';

// Force dynamic rendering - don't pre-render during build
export const dynamic = 'force-dynamic';

export const GET = withDebug(async (request, sessionId) => {
  try {
    // Fetch all relevant statuses in parallel
    const [signups, oauth, payments, ai] = await Promise.all([
      isSignupEnabled(),
      isOAuthEnabled(),
      isPaymentsEnabled(),
      isAIEnabled(),
    ]);

    return NextResponse.json({
      signups_enabled: signups,
      oauth_enabled: oauth,
      payments_enabled: payments,
      ai_enabled: ai,
    });
  } catch (error) {
    console.error('[Status API] Error fetching status:', error);
    // Return safe defaults on error
    return NextResponse.json({
      signups_enabled: true,
      oauth_enabled: true,
      payments_enabled: true,
      ai_enabled: true,
    });
  }
});
