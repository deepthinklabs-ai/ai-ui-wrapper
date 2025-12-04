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

    // If we already have an active subscription in DB, we're good
    if (subscription.status === 'active') {
      // Make sure user_profiles is also updated
      await supabase
        .from('user_profiles')
        .update({ tier: 'pro' })
        .eq('id', userId);

      return NextResponse.json({
        verified: true,
        tier: 'pro',
        message: 'Subscription is active',
      });
    }

    // Check Stripe directly for subscription status
    if (subscription.stripe_customer_id) {
      try {
        // List customer's subscriptions from Stripe
        const stripeSubscriptions = await stripe.subscriptions.list({
          customer: subscription.stripe_customer_id,
          status: 'active',
          limit: 1,
        });

        if (stripeSubscriptions.data.length > 0) {
          const activeSub = stripeSubscriptions.data[0];

          // Update subscriptions table
          await supabase
            .from('subscriptions')
            .update({
              stripe_subscription_id: activeSub.id,
              stripe_price_id: activeSub.items.data[0]?.price.id,
              status: 'active',
              current_period_start: new Date(activeSub.current_period_start * 1000).toISOString(),
              current_period_end: new Date(activeSub.current_period_end * 1000).toISOString(),
              cancel_at_period_end: activeSub.cancel_at_period_end,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', userId);

          // Update user_profiles tier
          await supabase
            .from('user_profiles')
            .update({ tier: 'pro' })
            .eq('id', userId);

          console.log(`✅ Verified subscription for user ${userId}, upgraded to pro`);

          return NextResponse.json({
            verified: true,
            tier: 'pro',
            message: 'Subscription verified and activated',
          });
        }
      } catch (stripeError) {
        console.error('Error checking Stripe:', stripeError);
      }
    }

    // No active subscription found
    return NextResponse.json({
      verified: false,
      tier: 'free',
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
