-- Migration: Fix sync_user_tier function to use correct tier values
-- Description: Update the function to use 'expired' instead of 'free' for canceled subscriptions
-- Date: 2025-12-05

-- ============================================================================
-- 0. Ensure trial_ends_at column exists (from migration 016)
-- ============================================================================

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- Update tier constraint to include new tiers (drop ALL old constraints first)
ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_tier_check;

ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS valid_tier;

ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_tier_check
CHECK (tier IN ('free', 'trial', 'pro', 'expired'));

-- ============================================================================
-- 1. Update sync_user_tier function to use new tier system
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_user_tier()
RETURNS TRIGGER AS $$
BEGIN
  -- If subscription is active or trialing, upgrade to pro
  IF NEW.status IN ('active', 'trialing') THEN
    UPDATE public.user_profiles
    SET tier = 'pro', updated_at = NOW()
    WHERE id = NEW.user_id;
  -- If subscription is canceled, past_due, or unpaid, set to expired (not 'free')
  ELSIF NEW.status IN ('canceled', 'past_due', 'unpaid', 'incomplete_expired') THEN
    UPDATE public.user_profiles
    SET tier = 'expired', updated_at = NOW()
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. Fix any users currently stuck with 'free' tier
-- ============================================================================

-- Users with 'free' tier who have a canceled/lapsed subscription → 'expired'
UPDATE public.user_profiles up
SET tier = 'expired', updated_at = NOW()
WHERE up.tier = 'free'
  AND EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = up.id
    AND s.status IN ('canceled', 'past_due', 'unpaid', 'incomplete_expired')
  );

-- Users with 'free' tier who never had a subscription → 'trial' with 7-day period
-- (This handles legacy free users who should get a trial)
UPDATE public.user_profiles up
SET tier = 'trial',
    trial_ends_at = NOW() + INTERVAL '7 days',
    updated_at = NOW()
WHERE up.tier = 'free'
  AND NOT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = up.id
  );

-- ============================================================================
-- 3. Update handle_new_user function to create users with 'trial' tier
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, tier, trial_ends_at)
  VALUES (NEW.id, 'trial', NOW() + INTERVAL '7 days');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON FUNCTION public.sync_user_tier IS 'Syncs user tier based on Stripe subscription status. Uses trial/pro/expired tier system.';
COMMENT ON FUNCTION public.handle_new_user IS 'Creates user profile with trial tier when new user signs up.';
