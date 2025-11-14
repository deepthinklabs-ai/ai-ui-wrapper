# Stripe Payment Integration Setup Guide

This guide walks you through setting up Stripe payments for the freemium subscription model.

## Overview

Your app now has a complete Stripe integration:
- **Free tier:** 5 threads, BYOK (Bring Your Own API Keys)
- **Pro tier:** Unlimited threads, included API access (coming soon)

## Step 1: Run Database Migrations

Run these SQL scripts in your Supabase SQL Editor:

### 1.1 User Profiles & Tier System
```sql
-- Copy contents from: database-migrations/add-user-tier.sql
```

### 1.2 Subscriptions Table
```sql
-- Copy contents from: database-migrations/add-subscriptions-table.sql
```

## Step 2: Create Stripe Account

1. Go to https://stripe.com
2. Click "Sign In" or "Start now"
3. Create account
4. You'll start in **Test Mode** (perfect for development)

## Step 3: Get Stripe API Keys

1. In Stripe Dashboard → **Developers** → **API keys**
2. Copy these keys:
   - **Publishable key** (starts with `pk_test_`)
   - **Secret key** (starts with `sk_test_`)

## Step 4: Create Subscription Product

1. Dashboard → **Products** → "+ Add product"
2. Fill in:
   - **Name:** Pro Plan
   - **Description:** Unlimited threads, included API access, priority support
   - **Pricing model:** Recurring
   - **Billing period:** Monthly
   - **Price:** $20 (or your chosen price)
3. Click **Save product**
4. Copy the **Price ID** (starts with `price_`)

## Step 5: Set Up Webhooks

Webhooks keep your database in sync with Stripe subscription events.

### 5.1 Development (localhost)
Use Stripe CLI to forward webhooks to localhost:

```bash
# Install Stripe CLI
# Windows: scoop install stripe
# Mac: brew install stripe/stripe-cli/stripe
# Or download from: https://stripe.com/docs/stripe-cli

# Login
stripe login

# Forward webhooks to your local server
stripe listen --forward-to http://localhost:3000/api/stripe/webhook
```

Copy the webhook signing secret (starts with `whsec_`)

### 5.2 Production
1. Dashboard → **Developers** → **Webhooks** → "+ Add endpoint"
2. Endpoint URL: `https://yourdomain.com/api/stripe/webhook`
3. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Click **Add endpoint**
5. Copy the **Signing secret** (starts with `whsec_`)

## Step 6: Add Environment Variables

Add these to your `.env.local` file:

```bash
# Stripe API Keys
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...

# Supabase Service Role Key (for server-side operations)
# Get this from: Supabase Dashboard → Settings → API → service_role key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## Step 7: Enable Customer Portal

The Customer Portal lets users manage their subscriptions.

1. Dashboard → **Settings** → **Billing** → **Customer portal**
2. Click **Activate test link**
3. Configure:
   - ✅ Allow customers to update payment methods
   - ✅ Allow customers to view invoices
   - ✅ Allow customers to cancel subscriptions
   - ✅ Save customer information
4. Click **Save**

## Step 8: Add Subscription UI to Settings Page

Update `src/app/settings/page.tsx`:

```tsx
import SubscriptionManagement from "@/components/settings/SubscriptionManagement";

// Inside your settings page component, add:
<SubscriptionManagement
  priceId={process.env.NEXT_PUBLIC_STRIPE_PRICE_ID}
/>
```

Don't forget to add `NEXT_PUBLIC_STRIPE_PRICE_ID` to `.env.local`:
```bash
NEXT_PUBLIC_STRIPE_PRICE_ID=price_...
```

## Step 9: Test the Flow

### 9.1 Test Upgrade Flow
1. Start dev server: `npm run dev`
2. Start webhook forwarding: `stripe listen --forward-to http://localhost:3000/api/stripe/webhook`
3. Go to http://localhost:3000/settings
4. Click "Upgrade to Pro"
5. Use test card: `4242 4242 4242 4242`
6. Expiry: Any future date
7. CVC: Any 3 digits
8. Complete checkout
9. Verify:
   - User redirected to dashboard with success message
   - Database `subscriptions` table has new row
   - `user_profiles.tier` is now 'pro'
   - User can now create unlimited threads

### 9.2 Test Customer Portal
1. As a Pro user, go to Settings
2. Click "Manage Subscription"
3. Verify you can:
   - Update payment method
   - View invoices
   - Cancel subscription
4. Test cancellation:
   - Cancel subscription
   - Verify tier downgrades to 'free'
   - Verify thread limit enforced again

## Step 10: Go Live

When ready for production:

1. Switch Stripe to **Live Mode** (toggle in dashboard)
2. Get new Live API keys
3. Create webhook endpoint with production URL
4. Update `.env.local` with live keys
5. Deploy to production

## Stripe Test Cards

Use these for testing:

| Card Number | Description |
|-------------|-------------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 9995 | Decline |
| 4000 0000 0000 3220 | 3D Secure required |

Full list: https://stripe.com/docs/testing

## Architecture Overview

```
User clicks "Upgrade"
    ↓
/api/stripe/checkout creates Checkout Session
    ↓
User redirected to Stripe Checkout
    ↓
User completes payment
    ↓
Stripe sends webhook to /api/stripe/webhook
    ↓
Webhook updates subscriptions table
    ↓
Database trigger updates user_profiles.tier to 'pro'
    ↓
User has unlimited threads!
```

## Troubleshooting

### Webhook not working
- Check Stripe CLI is running: `stripe listen --forward-to ...`
- Check webhook secret in `.env.local` matches CLI output
- Check server logs for webhook errors

### Subscription not updating
- Check Supabase logs for errors
- Verify `subscriptions` table exists
- Verify RLS policies allow updates

### Can't create checkout session
- Check Stripe keys are correct
- Check SUPABASE_SERVICE_ROLE_KEY is set
- Check price ID is correct

## Next Steps

After payments are working:
1. Build backend API proxy for Pro users (so they don't need API keys)
2. Add usage tracking and rate limiting
3. Add email notifications for subscription events
4. Add analytics dashboard

## Support

- Stripe Docs: https://stripe.com/docs
- Stripe Support: https://support.stripe.com
