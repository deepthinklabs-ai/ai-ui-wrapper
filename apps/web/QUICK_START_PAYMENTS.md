# Quick Start: Test Payment Flow (10 Minutes)

This guide gets your payment flow working in ~10 minutes so you can see it in action.

## Prerequisites

- Running dev server: `npm run dev`
- Your Supabase project

## Step 1: Run Database Migrations (2 minutes)

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Click on your project
3. Click "SQL Editor" in the left sidebar
4. Click "New Query"

### Migration 1: User Profiles & Tiers
Copy and paste the entire contents of `database-migrations/add-user-tier.sql` and click **Run**

### Migration 2: Subscriptions Table
Copy and paste the entire contents of `database-migrations/add-subscriptions-table.sql` and click **Run**

**Verify:**
- Go to "Table Editor" → You should see `user_profiles` and `subscriptions` tables
- Click on `user_profiles` → You should see your user with `tier = 'free'`

## Step 2: Get Supabase Service Role Key (1 minute)

1. In Supabase Dashboard → **Settings** → **API**
2. Scroll down to "**Project API keys**"
3. Find "**service_role** key" (click "Reveal" if hidden)
4. Copy it (starts with `eyJhbGci...`)

## Step 3: Create Stripe Account (3 minutes)

1. Go to https://stripe.com
2. Click "Sign In" or "Start now"
3. Create account (use your email)
4. After signup, you'll be in **Test Mode** by default ✅

## Step 4: Get Stripe API Keys (1 minute)

1. In Stripe Dashboard → **Developers** → **API keys**
2. Copy these two keys:
   - **Publishable key:** `pk_test_...` (we don't need this for now)
   - **Secret key:** `sk_test_...` ← Click "Reveal" and copy

## Step 5: Create Pro Plan Product (2 minutes)

1. Dashboard → **Products** → **"+ Add product"**
2. Fill in:
   - **Name:** `Pro Plan`
   - **Description:** `Unlimited threads, included API access, priority support`
   - **Pricing model:** Recurring
   - **Billing period:** Monthly
   - **Price:** `$20.00` (or whatever you want)
3. Click **"Save product"**
4. **Copy the Price ID** (starts with `price_...`) - you'll see it in the pricing section

## Step 6: Set Up Webhook Forwarding (1 minute)

### Option A: Using Stripe CLI (Recommended)

Download and install Stripe CLI:
- **Windows:** `scoop install stripe`
- **Mac:** `brew install stripe/stripe-cli/stripe`
- **Or:** https://stripe.com/docs/stripe-cli

Then run:
```bash
stripe login
stripe listen --forward-to http://localhost:3000/api/stripe/webhook
```

Keep this terminal open! Copy the webhook signing secret that appears (starts with `whsec_...`)

### Option B: Skip webhooks for now (Testing checkout only)

You can skip this step if you just want to test the checkout flow. Your subscription won't auto-update in the database, but you can manually update it in Supabase.

## Step 7: Add Environment Variables (1 minute)

Add these to your `.env.local` file:

```bash
# Add these NEW lines (keep your existing Supabase keys)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...  # From Step 2
STRIPE_SECRET_KEY=sk_test_...          # From Step 4
STRIPE_WEBHOOK_SECRET=whsec_...        # From Step 6
STRIPE_PRICE_ID=price_...              # From Step 5
NEXT_PUBLIC_STRIPE_PRICE_ID=price_...  # Same as above
```

**Restart your dev server** after adding these!

```bash
# Stop the server (Ctrl+C) and restart:
npm run dev
```

## Step 8: Test the Flow! (2 minutes)

### 8.1 Check Current Status
1. Go to http://localhost:3000/dashboard
2. Try to create 5 threads
3. On the 6th try, you should see: **"Thread Limit Reached"** with upgrade link ✅

### 8.2 Test Upgrade Flow
1. Click **"upgrade to Pro"** in the warning, or go to http://localhost:3000/settings
2. You should see:
   - Your current plan: **"Free"**
   - Thread count: **5/5 threads**
   - Upgrade button
3. Click **"Upgrade to Pro"**
4. You'll be redirected to Stripe Checkout
5. Use test card:
   - **Card:** `4242 4242 4242 4242`
   - **Expiry:** Any future date (e.g., `12/25`)
   - **CVC:** Any 3 digits (e.g., `123`)
   - **ZIP:** Any 5 digits (e.g., `12345`)
6. Click **"Subscribe"**

### 8.3 Verify Pro Status
After checkout completes:
1. You'll be redirected back to `/dashboard?upgrade=success`
2. **Refresh the page**
3. Check sidebar - you should see **"Pro"** badge next to your email ✅
4. Try creating more threads - no limit! ✅
5. Go to Settings - you should see **"You're on the Pro plan"** ✅

### 8.4 Verify Database
1. Go to Supabase → **Table Editor** → **user_profiles**
2. Your row should show `tier = 'pro'` ✅
3. Go to **subscriptions** table
4. You should see a row with:
   - Your `user_id`
   - `stripe_customer_id` (starts with `cus_`)
   - `stripe_subscription_id` (starts with `sub_`)
   - `status = 'active'` ✅

## Step 9: Test Customer Portal (1 minute)

1. As a Pro user, go to http://localhost:3000/settings
2. Click **"Manage Subscription"**
3. You'll be redirected to Stripe Customer Portal
4. You can:
   - Update payment method
   - View invoices
   - **Cancel subscription** (let's test this)
5. Click **"Cancel plan"** → **"Cancel plan"** (confirm)
6. Go back to your app and **refresh**
7. Your tier should be back to **"Free"** and thread limit enforced again ✅

## 🎉 Success!

You now have a working freemium payment system:
- ✅ Free tier: 5 threads max
- ✅ Pro tier: Unlimited threads
- ✅ Stripe checkout flow
- ✅ Automatic tier sync
- ✅ Customer portal for subscription management

## Troubleshooting

### "No subscription found" error
- Make sure you added `SUPABASE_SERVICE_ROLE_KEY` to `.env.local`
- Restart dev server after adding env vars

### Webhook not working
- Make sure Stripe CLI is running: `stripe listen --forward-to ...`
- Check webhook secret matches in `.env.local`

### Can't see Pro badge after payment
- Refresh the page
- Check Supabase `user_profiles` table - is `tier = 'pro'`?
- Check browser console for errors

### "Configure pricing first" button
- Make sure you added `NEXT_PUBLIC_STRIPE_PRICE_ID` to `.env.local`
- Restart dev server

## Next Steps

Once this is working:
1. **Add Pro User Benefits:** Build backend API proxy so Pro users don't need their own API keys
2. **Go Live:** Switch to live Stripe keys when ready for production
3. **Add Analytics:** Track conversions, churn, MRR
4. **Email Notifications:** Welcome emails, payment failures, etc.

## Need Help?

Check the detailed guide: `STRIPE_SETUP_GUIDE.md`
