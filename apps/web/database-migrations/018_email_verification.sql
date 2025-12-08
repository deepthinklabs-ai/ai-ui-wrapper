-- Email Verification / 2FA System
-- Stores verification codes for email-based 2FA

-- Table for storing verification codes
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT 'login', -- 'login', 'signup', 'password_reset'
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent brute force by limiting attempts
  CONSTRAINT max_attempts CHECK (attempts <= 5)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_email_verification_user_id ON email_verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_code ON email_verification_codes(code);
CREATE INDEX IF NOT EXISTS idx_email_verification_expires ON email_verification_codes(expires_at);

-- Add 2FA enabled flag to user_profiles
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS email_2fa_enabled BOOLEAN DEFAULT FALSE;

-- Add index for 2FA enabled users
CREATE INDEX IF NOT EXISTS idx_user_profiles_2fa_enabled ON user_profiles(email_2fa_enabled);

-- Function to clean up expired codes (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_verification_codes()
RETURNS void AS $$
BEGIN
  DELETE FROM email_verification_codes
  WHERE expires_at < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- RLS policies for email_verification_codes
ALTER TABLE email_verification_codes ENABLE ROW LEVEL SECURITY;

-- Users can only read their own verification codes
CREATE POLICY "Users can view own verification codes"
ON email_verification_codes
FOR SELECT
USING (auth.uid() = user_id);

-- Only server (service role) can insert/update/delete verification codes
-- This prevents users from creating their own codes
CREATE POLICY "Service role can manage verification codes"
ON email_verification_codes
FOR ALL
USING (auth.role() = 'service_role');

-- Grant necessary permissions
GRANT SELECT ON email_verification_codes TO authenticated;
GRANT ALL ON email_verification_codes TO service_role;
