/**
 * Stripe Configuration
 *
 * Server-side Stripe SDK initialization and utilities
 */

import Stripe from 'stripe';

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

  // Success/cancel URLs (will be set dynamically based on request)
  successUrl: '/dashboard?upgrade=success',
  cancelUrl: '/dashboard',  // Returns to dashboard, which shows plan selection for pending users
};
