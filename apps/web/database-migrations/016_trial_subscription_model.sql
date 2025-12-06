-- Migration: Trial Subscription Model
-- Description: Update subscription model to trial/pro/expired with 7-day trial
-- Date: 2025-12-05

-- ============================================================================
-- 1. Add trial_ends_at column to user_profiles
-- ============================================================================

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

-- ============================================================================
-- 2. Update tier constraint to include new tiers
-- ============================================================================

-- Drop existing constraint if it exists
ALTER TABLE user_profiles
DROP CONSTRAINT IF EXISTS user_profiles_tier_check;

-- Add new constraint with trial/pro/expired tiers
ALTER TABLE user_profiles
ADD CONSTRAINT user_profiles_tier_check
CHECK (tier IN ('trial', 'pro', 'expired'));

-- ============================================================================
-- 3. Migrate existing users
-- ============================================================================

-- Convert existing 'free' users to 'trial' with 7-day trial starting now
UPDATE user_profiles
SET tier = 'trial',
    trial_ends_at = NOW() + INTERVAL '7 days'
WHERE tier = 'free';

-- Pro users stay as 'pro' (no change needed)

-- ============================================================================
-- 4. Add trial rate limits (25% of pro limits)
-- ============================================================================

-- First, let's see existing pro limits and create trial limits at 25%
-- This inserts trial limits based on existing pro limits

INSERT INTO model_rate_limits (tier, model_name, daily_requests, daily_tokens, requests_per_minute, warning_threshold)
SELECT
    'trial' as tier,
    model_name,
    GREATEST(FLOOR(daily_requests * 0.25), 5) as daily_requests,  -- At least 5 requests
    GREATEST(FLOOR(daily_tokens * 0.25), 10000) as daily_tokens,  -- At least 10k tokens
    GREATEST(FLOOR(requests_per_minute * 0.25), 2) as requests_per_minute,  -- At least 2 per minute
    warning_threshold
FROM model_rate_limits
WHERE tier = 'pro'
ON CONFLICT (tier, model_name) DO UPDATE SET
    daily_requests = EXCLUDED.daily_requests,
    daily_tokens = EXCLUDED.daily_tokens,
    requests_per_minute = EXCLUDED.requests_per_minute;

-- ============================================================================
-- 5. Create function to check and expire trials
-- ============================================================================

CREATE OR REPLACE FUNCTION check_trial_expiration()
RETURNS TRIGGER AS $$
BEGIN
    -- If trial has expired and user is still on trial tier, mark as expired
    IF NEW.tier = 'trial' AND NEW.trial_ends_at IS NOT NULL AND NEW.trial_ends_at < NOW() THEN
        NEW.tier := 'expired';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-expire trials on profile access
DROP TRIGGER IF EXISTS trigger_check_trial_expiration ON user_profiles;
CREATE TRIGGER trigger_check_trial_expiration
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION check_trial_expiration();

-- ============================================================================
-- 6. Add index for trial expiration queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_profiles_trial_ends_at
ON user_profiles (trial_ends_at)
WHERE tier = 'trial';

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON COLUMN user_profiles.trial_ends_at IS 'Timestamp when the 7-day trial period ends';
COMMENT ON COLUMN user_profiles.tier IS 'User subscription tier: trial (7-day free), pro ($50/mo), expired (trial ended)';
