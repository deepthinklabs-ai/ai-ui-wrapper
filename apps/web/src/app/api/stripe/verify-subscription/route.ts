/**
 * Verify Subscription API
 *
 * Fallback endpoint to verify and activate subscriptions
 * Used when webhooks don't reach the server (e.g., localhost development)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'Missing userId' },
        { status: 400 }
      );
    }

    // Initialize Supabase client with service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get user's subscription record
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id, stripe_subscription_id, status')
      .eq('user_id', userId)
      .single();

    if (subError || !subscription) {
      return NextResponse.json({
        verified: false,
        tier: 'free',
        message: 'No subscription found',
      });
    }

    // If we already have an active or trialing subscription in DB, we're good
    if (subscription.status === 'active' || subscription.status === 'trialing') {
      // Set tier based on subscription status: trialing = trial, active = pro
      const userTier = subscription.status === 'trialing' ? 'trial' : 'pro';

      await supabase
        .from('user_profiles')
        .update({ tier: userTier })
        .eq('id', userId);

      return NextResponse.json({
        verified: true,
        tier: userTier,
        message: `Subscription is ${subscription.status}`,
      });
    }

    // Check Stripe directly for subscription status
    if (subscription.stripe_customer_id) {
      try {
        // List customer's active subscriptions from Stripe
        let stripeSubscriptions = await stripe.subscriptions.list({
          customer: subscription.stripe_customer_id,
          status: 'active',
          limit: 1,
        });

        // If no active, check for trialing (7-day free trial)
        if (stripeSubscriptions.data.length === 0) {
          stripeSubscriptions = await stripe.subscriptions.list({
            customer: subscription.stripe_customer_id,
            status: 'trialing',
            limit: 1,
          });
        }

        if (stripeSubscriptions.data.length > 0) {
          const sub = stripeSubscriptions.data[0];
          // Set tier based on subscription status: trialing = trial, active = pro
          const userTier = sub.status === 'trialing' ? 'trial' : 'pro';

          // Get trial end date if trialing
          const trialEndsAt = sub.trial_end
            ? new Date(sub.trial_end * 1000).toISOString()
            : null;

          // Update subscriptions table
          await supabase
            .from('subscriptions')
            .update({
              stripe_subscription_id: sub.id,
              stripe_price_id: sub.items.data[0]?.price.id,
              status: sub.status, // 'active' or 'trialing'
              current_period_start: new Date(sub.current_period_start * 1000).toISOString(),
              current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              cancel_at_period_end: sub.cancel_at_period_end,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

          // Update user_profiles tier and trial_ends_at
          await supabase
            .from('user_profiles')
            .update({
              tier: userTier,
              trial_ends_at: trialEndsAt,
            })
            .eq('id', userId);

          console.log(`✅ Verified subscription for user ${userId} (${sub.status}), set to ${userTier}`);

          return NextResponse.json({
            verified: true,
            tier: userTier,
            message: `Subscription verified (${sub.status})`,
          });
        }
      } catch (stripeError) {
        console.error('Error checking Stripe:', stripeError);
      }
    }

    // No active subscription found
    return NextResponse.json({
      verified: false,
      tier: 'trial',
      message: 'No active subscription found in Stripe',
    });
  } catch (error: any) {
    console.error('Error verifying subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to verify subscription' },
      { status: 500 }
    );
  }
}
