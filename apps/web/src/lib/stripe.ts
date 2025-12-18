/**
 * @security-audit-requested
 * AUDIT FOCUS: Stripe Configuration Security
 * - Is STRIPE_SECRET_KEY properly protected?
 * - Is STRIPE_WEBHOOK_SECRET properly protected?
 * - Could missing webhook secret allow unsigned webhooks?
 * - Are success/cancel URLs validated against allowed domains?
 */

/**
 * Stripe Configuration
 *
 * Server-side Stripe SDK initialization and utilities
 */

import Stripe from 'stripe';
import { STRIPE_REDIRECTS } from '@/lib/config/routes';

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing STRIPE_SECRET_KEY environment variable');
}

// Initialize Stripe SDK
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-02-24.acacia', // Latest API version
  typescript: true,
});

// Stripe configuration constants
export const STRIPE_CONFIG = {
  // You'll set this in Stripe Dashboard after creating the product
  // For now, we'll pass it dynamically from the checkout flow
  priceId: process.env.STRIPE_PRICE_ID || '',

  // Webhook secret for verifying webhook signatures
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',

  // Success/cancel URLs - centralized in routes config
  successUrl: STRIPE_REDIRECTS.SUCCESS_URL,
  cancelUrl: STRIPE_REDIRECTS.CANCEL_URL,
};
