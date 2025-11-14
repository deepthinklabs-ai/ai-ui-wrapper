-- Add onboarding_completed column to user_profiles table
-- This tracks whether a user has completed the initial onboarding flow

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Update existing users to have onboarding_completed = true
-- (they've already been using the app)
UPDATE user_profiles
SET onboarding_completed = TRUE
WHERE onboarding_completed IS NULL OR onboarding_completed = FALSE;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding_completed
ON user_profiles(onboarding_completed);
