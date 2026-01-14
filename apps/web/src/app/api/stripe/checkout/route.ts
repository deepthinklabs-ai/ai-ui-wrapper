/**
 * @security-audit-requested
 * AUDIT FOCUS: Stripe Checkout Security
 * - Is userId validated against the authenticated user (IDOR)? ✅ FIXED
 * - Can an attacker create checkout sessions for other users? ✅ FIXED
 * - Is priceId validated against allowed prices? ✅ FIXED
 * - Can trialDays be manipulated for extended trials? ✅ FIXED
 * - Is the origin header trusted for redirect URLs (open redirect)? ✅ FIXED
 * - Are duplicate subscription checks sufficient?
 */

/**
 * Stripe Checkout Session API Route
 *
 * Creates a Stripe Checkout session for users to subscribe to Pro plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, STRIPE_CONFIG } from '@/lib/stripe';
import { getAuthenticatedUser } from '@/lib/serverAuth';
import { validateForFeature } from '@/lib/validateEnv';
import { checkPaymentsEnabled } from '@/lib/killSwitches';
import { withDebug } from '@/lib/debug';

// SECURITY: Allowed origins for redirect URLs
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  process.env.NEXT_PUBLIC_APP_URL,
  process.env.APP_URL,
  // Vercel preview/staging deployments
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
].filter(Boolean) as string[];

// SECURITY: Pattern for Vercel preview deployments (validated separately)
// Tightened to only match this project's preview deployments
// Uses VERCEL_PROJECT_PRODUCTION_URL or falls back to project name pattern
const getVercelPreviewPattern = (): RegExp => {
  // Try to extract project name from production URL (e.g., "ai-ui-wrapper.vercel.app" -> "ai-ui-wrapper")
  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const projectName = productionUrl?.split('.')[0] || process.env.VERCEL_PROJECT || 'ai-ui-wrapper';
  // Escape any special regex characters in project name
  const escapedProjectName = projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match: https://{projectName}-{anything}.vercel.app
  return new RegExp(`^https:\\/\\/${escapedProjectName}-[\\w-]+\\.vercel\\.app$`);
};
const VERCEL_PREVIEW_PATTERN = getVercelPreviewPattern();

// SECURITY: Maximum allowed trial days
const MAX_TRIAL_DAYS = 14;

export const POST = withDebug(async (req, sessionId) => {
  // Validate Stripe configuration
  const envCheck = validateForFeature('stripe');
  if (!envCheck.valid) {
    console.error('[Stripe Checkout] Missing configuration:', envCheck.missing);
    return NextResponse.json(
      { error: 'Payment service not configured' },
      { status: 503 }
    );
  }

  // KILL SWITCH: Check if payments are enabled
  const paymentsCheck = await checkPaymentsEnabled();
  if (!paymentsCheck.enabled) {
    return NextResponse.json(
      { error: paymentsCheck.error!.message },
      { status: paymentsCheck.error!.status }
    );
  }

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
    const { userId, priceId, trialDays } = body;

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
        { error: 'Forbidden: Cannot create checkout for another user' },
        { status: 403 }
      );
    }

    if (!priceId) {
      return NextResponse.json(
        { error: 'Missing priceId' },
        { status: 400 }
      );
    }

    // SECURITY: Validate priceId against allowed prices
    const allowedPrices = [
      process.env.STRIPE_PRICE_ID,
    ].filter(Boolean);

    if (!allowedPrices.includes(priceId)) {
      return NextResponse.json(
        { error: 'Invalid price ID' },
        { status: 400 }
      );
    }

    // SECURITY: Cap trial days to prevent manipulation
    const validatedTrialDays = trialDays
      ? Math.min(Math.max(0, Number(trialDays) || 0), MAX_TRIAL_DAYS)
      : 0;

    // DEBUG: Log the price ID being used (don't log in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('[Stripe Checkout] Creating session with:', {
        priceId,
        userId,
        trialDays: validatedTrialDays,
        envPriceId: process.env.STRIPE_PRICE_ID,
      });
    }

    // Initialize Supabase client (server-side with service role key)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get user info
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId);

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user already has an active subscription
    const { data: existingSubscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id, status, stripe_subscription_id')
      .eq('user_id', userId)
      .single();

    // Prevent duplicate subscriptions
    if (existingSubscription?.status && ['active', 'trialing'].includes(existingSubscription.status)) {
      return NextResponse.json(
        { error: 'You already have an active subscription. Please manage your existing subscription instead.' },
        { status: 400 }
      );
    }

    // If there's an incomplete subscription, check if it has a Stripe subscription ID
    if (existingSubscription?.stripe_subscription_id) {
      // Check the status in Stripe to be extra sure
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(existingSubscription.stripe_subscription_id);
        if (['active', 'trialing'].includes(stripeSubscription.status)) {
          return NextResponse.json(
            { error: 'You already have an active subscription in Stripe. Please contact support if you believe this is an error.' },
            { status: 400 }
          );
        }
      } catch (err) {
        // Subscription doesn't exist in Stripe anymore, we can proceed
        console.log('Stripe subscription not found, allowing new checkout');
      }
    }

    let customerId = existingSubscription?.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.user.email,
        metadata: {
          supabase_user_id: userId,
        },
      });
      customerId = customer.id;

      // Store customer ID in database
      await supabase.from('subscriptions').insert({
        user_id: userId,
        stripe_customer_id: customerId,
        status: 'incomplete',
      });
    }

    // SECURITY: Validate origin against allowed domains to prevent open redirect
    const requestOrigin = req.headers.get('origin');
    const isAllowedOrigin = requestOrigin && (
      ALLOWED_ORIGINS.includes(requestOrigin) ||
      VERCEL_PREVIEW_PATTERN.test(requestOrigin)
    );
    if (!requestOrigin || !isAllowedOrigin) {
      console.error('[Stripe Checkout] Invalid origin:', requestOrigin, 'Allowed:', ALLOWED_ORIGINS);
      return NextResponse.json(
        { error: 'Invalid or missing origin' },
        { status: 403 }
      );
    }
    const origin = requestOrigin;

    // Create Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${origin}${STRIPE_CONFIG.successUrl}`,
      cancel_url: `${origin}${STRIPE_CONFIG.cancelUrl}`,
      metadata: {
        user_id: userId,
      },
      allow_promotion_codes: true, // Allow users to apply promo codes
      // Add trial period if specified (capped at MAX_TRIAL_DAYS)
      ...(validatedTrialDays > 0 ? {
        subscription_data: {
          trial_period_days: validatedTrialDays,
        },
      } : {}),
    });

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
});
