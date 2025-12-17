/**
 * @security-audit-requested
 * AUDIT FOCUS: Stripe Webhook Security (CRITICAL - payment/subscription control)
 * - Is the webhook signature verification secure and complete?
 * - Can replay attacks bypass the signature check?
 * - Is user_id from metadata trusted without validation?
 * - Can a malicious webhook forge subscription status changes?
 * - Is there proper error handling that doesn't leak info?
 * - Are database updates atomic (race conditions)?
 * - Can webhook events be processed out of order causing issues?
 */

/**
 * Stripe Webhook Handler
 *
 * Listens to Stripe events and updates subscription status in database
 * This keeps user tier in sync with Stripe subscription status
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { stripe, STRIPE_CONFIG } from '@/lib/stripe';
import { mapStripeStatusToTier } from '@/lib/config/tiers';
import Stripe from 'stripe';

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      STRIPE_CONFIG.webhookSecret
    );
  } catch (error: any) {
    console.error('Webhook signature verification failed:', error.message);
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    );
  }

  // Initialize Supabase client (server-side with service role key)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // Handle different event types
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (!userId) {
          console.error('Missing user_id in session metadata');
          break;
        }

        // Fetch the subscription from Stripe to get actual status
        const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
        const subStatus = stripeSubscription.status; // 'trialing' or 'active'
        const userTier = subStatus === 'trialing' ? 'trial' : 'pro';
        const trialEndsAt = stripeSubscription.trial_end
          ? new Date(stripeSubscription.trial_end * 1000).toISOString()
          : null;

        // Update subscription record with subscription ID and actual status
        await supabase
          .from('subscriptions')
          .update({
            stripe_subscription_id: subscriptionId,
            status: subStatus,
            current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('stripe_customer_id', customerId);

        // Update user_profiles tier and mark onboarding as complete
        // This is the ONLY place onboarding should be marked complete
        // to prevent users from bypassing payment
        await supabase
          .from('user_profiles')
          .update({
            tier: userTier,
            trial_ends_at: trialEndsAt,
            onboarding_completed: true,
          })
          .eq('id', userId);

        console.log(`✅ Checkout completed for user ${userId}, set to ${userTier} (status: ${subStatus}), onboarding marked complete`);
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Get user_id from customer
        const { data: existingRecord } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!existingRecord) {
          console.error('No subscription record found for customer:', customerId);
          break;
        }

        // Determine tier based on subscription status (using centralized mapping)
        const userTier = mapStripeStatusToTier(subscription.status);
        const trialEndsAt = subscription.status === 'trialing' && subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null;

        // Update subscription status
        await supabase
          .from('subscriptions')
          .update({
            stripe_subscription_id: subscription.id,
            stripe_price_id: subscription.items.data[0]?.price.id,
            status: subscription.status,
            current_period_start: subscription.current_period_start
              ? new Date(subscription.current_period_start * 1000).toISOString()
              : null,
            current_period_end: subscription.current_period_end
              ? new Date(subscription.current_period_end * 1000).toISOString()
              : null,
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', existingRecord.user_id)
          .eq('stripe_customer_id', customerId);

        // Update user_profiles tier if we determined one
        if (userTier) {
          await supabase
            .from('user_profiles')
            .update({
              tier: userTier,
              ...(trialEndsAt ? { trial_ends_at: trialEndsAt } : {}),
            })
            .eq('id', existingRecord.user_id);
        }

        console.log(`✅ Subscription ${event.type} for customer ${customerId}: ${subscription.status} -> tier: ${userTier}`);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        // Get user_id from customer
        const { data: existingRecord } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!existingRecord) {
          console.error('No subscription record found for customer:', customerId);
          break;
        }

        // Mark subscription as canceled
        await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', existingRecord.user_id)
          .eq('stripe_customer_id', customerId);

        console.log(`✅ Subscription deleted for customer ${customerId}`);
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Get user_id from customer
        const { data: existingRecord } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (!existingRecord) {
          console.error('No subscription record found for customer:', customerId);
          break;
        }

        // Mark subscription as past_due
        await supabase
          .from('subscriptions')
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', existingRecord.user_id)
          .eq('stripe_customer_id', customerId);

        console.log(`⚠️ Payment failed for customer ${customerId}`);
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}
