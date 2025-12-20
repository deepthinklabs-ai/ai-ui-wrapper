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

-- Create a SECURITY DEFINER function to check admin status (bypasses RLS)
-- This prevents infinite recursion when the policy checks user_profiles
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.user_profiles WHERE id = user_uuid),
    FALSE
  );
$$;

-- RLS policy: Allow admins to read all profiles (for admin dashboard)
-- Regular users can still only read their own profile
-- Uses is_admin() function to avoid infinite recursion
CREATE POLICY "Admins can read all profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id OR
    public.is_admin(auth.uid())
  );

-- Comment for documentation
COMMENT ON COLUMN public.user_profiles.is_admin IS 'Whether user has admin privileges for system configuration and kill switch management';

-- After running this migration, set your user as admin:
-- UPDATE user_profiles SET is_admin = true WHERE id = 'your-user-id';
