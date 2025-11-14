-- Add subscriptions table to track Stripe subscription data
-- This table stores the relationship between users and their Stripe subscriptions

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  status TEXT NOT NULL DEFAULT 'incomplete',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid'))
);

-- Enable RLS
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own subscriptions
CREATE POLICY "Users can read own subscriptions"
  ON public.subscriptions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer_id ON public.subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription_id ON public.subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);

-- Function to sync user tier based on subscription status
CREATE OR REPLACE FUNCTION public.sync_user_tier()
RETURNS TRIGGER AS $$
BEGIN
  -- If subscription is active or trialing, upgrade to pro
  IF NEW.status IN ('active', 'trialing') THEN
    UPDATE public.user_profiles
    SET tier = 'pro', updated_at = NOW()
    WHERE id = NEW.user_id;
  -- If subscription is canceled, past_due, or unpaid, downgrade to free
  ELSIF NEW.status IN ('canceled', 'past_due', 'unpaid', 'incomplete_expired') THEN
    UPDATE public.user_profiles
    SET tier = 'free', updated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically sync user tier when subscription status changes
DROP TRIGGER IF EXISTS on_subscription_status_change ON public.subscriptions;
CREATE TRIGGER on_subscription_status_change
  AFTER INSERT OR UPDATE OF status ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_tier();
