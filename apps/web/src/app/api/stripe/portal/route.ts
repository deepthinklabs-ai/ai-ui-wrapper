/**
 * @security-audit-requested
 * AUDIT FOCUS: Stripe Portal Security
 * - Is userId validated against the authenticated user (IDOR)? ✅ FIXED
 * - Can an attacker access another user's billing portal? ✅ FIXED
 * - Is the origin header trusted for return URL (open redirect)? ✅ FIXED
 * - Is there rate limiting to prevent abuse?
 */

/**
 * Stripe Customer Portal API Route
 *
 * Creates a Stripe Customer Portal session for users to manage their subscription
 * (update payment method, cancel subscription, view invoices, etc.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { withDebug } from '@/lib/debug';

// SECURITY: Allowed origins for redirect URLs
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.APP_URL,
].filter(Boolean) as string[];

export const POST = withDebug(async (req, sessionId) => {
  try {
    // SECURITY: Require authentication
    const authResult = await getAuthenticatedUser(req);
    if (authResult.error || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { userId } = body;

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    // SECURITY: Verify the authenticated user matches the requested userId (prevent IDOR)
    if (authResult.user.id !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot access another user\'s billing portal' },
        { status: 403 }
      );
    }

    // Initialize Supabase client (server-side with service role key)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get user's Stripe customer ID
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (subError || !subscription?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      );
    }

    // SECURITY: Validate origin against allowed domains to prevent open redirect
    const requestOrigin = req.headers.get('origin');
    if (!requestOrigin || !ALLOWED_ORIGINS.includes(requestOrigin)) {
      return NextResponse.json(
        { error: 'Invalid or missing origin' },
        { status: 403 }
      );
    }
    const origin = requestOrigin;

    // Create Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: `${origin}/settings`,
    });

    return NextResponse.json({
      url: session.url,
    });
  } catch (error: any) {
    console.error('Error creating portal session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create portal session' },
      { status: 500 }
    );
  }
});
