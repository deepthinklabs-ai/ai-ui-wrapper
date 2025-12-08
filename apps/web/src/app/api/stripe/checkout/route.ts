/**
 * Stripe Checkout Session API Route
 *
 * Creates a Stripe Checkout session for users to subscribe to Pro plan
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, STRIPE_CONFIG } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, priceId, trialDays } = body;

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    if (!priceId) {
      return NextResponse.json(
        { error: 'Missing priceId' },
        { status: 400 }
      );
    }

    // DEBUG: Log the price ID being used
    console.log('[Stripe Checkout] Creating session with:', {
      priceId,
      userId,
      trialDays,
      envPriceId: process.env.STRIPE_PRICE_ID,
    });

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

    // Get the origin for redirect URLs
    const origin = req.headers.get('origin') || 'http://localhost:3000';

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
      // Add trial period if specified (for 7-day free trial)
      ...(trialDays && trialDays > 0 ? {
        subscription_data: {
          trial_period_days: trialDays,
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
}
