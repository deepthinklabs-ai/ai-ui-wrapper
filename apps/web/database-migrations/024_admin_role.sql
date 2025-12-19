-- Migration: Admin Role
-- Description: Add is_admin flag to user_profiles for admin access control
--              Admins can access the kill switch management UI and receive notifications.

-- Add is_admin column to user_profiles
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Create partial index for efficient admin queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_admin
ON public.user_profiles (is_admin)
WHERE is_admin = TRUE;

-- Drop existing policy if it conflicts (allows re-running migration)
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.user_profiles;

-- RLS policy: Allow admins to read all profiles (for admin dashboard)
-- Regular users can still only read their own profile
CREATE POLICY "Admins can read all profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND is_admin = TRUE
    )
  );

-- Comment for documentation
COMMENT ON COLUMN public.user_profiles.is_admin IS 'Whether user has admin privileges for system configuration and kill switch management';

-- After running this migration, set your user as admin:
-- UPDATE user_profiles SET is_admin = true WHERE id = 'your-user-id';
