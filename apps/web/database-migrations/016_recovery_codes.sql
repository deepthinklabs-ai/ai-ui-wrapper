-- Migration: Add recovery codes and audit logging for encryption
-- Description: Stores recovery code bundles and tracks encryption events
-- Created: 2025-12-03

-- Add recovery_codes_bundle column to user_profiles
-- This stores hashed recovery codes and wrapped keys (server can verify but not decrypt)
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS recovery_codes_bundle JSONB DEFAULT NULL;

COMMENT ON COLUMN user_profiles.recovery_codes_bundle IS
'Recovery codes for encryption key recovery. Structure: {codeHashes: string[], wrappedKeys: [{codeHash, wrappedKey, salt, iv}], createdAt: string, usedCodes: string[]}. Server stores hashes only.';

-- Add encryption setup status
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS encryption_setup_at TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN user_profiles.encryption_setup_at IS
'Timestamp when user completed encryption setup (set password + saved recovery codes)';

-- Add recovery codes delivery method chosen
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS recovery_codes_delivery_method VARCHAR(50) DEFAULT NULL;

COMMENT ON COLUMN user_profiles.recovery_codes_delivery_method IS
'How user chose to receive recovery codes: download_pdf, email, print, copy, enterprise_admin';

-- Create audit log table for encryption events
CREATE TABLE IF NOT EXISTS encryption_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  event_data JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying user's audit history
CREATE INDEX IF NOT EXISTS idx_encryption_audit_user_id
ON encryption_audit_log(user_id, created_at DESC);

-- Index for querying by event type
CREATE INDEX IF NOT EXISTS idx_encryption_audit_event_type
ON encryption_audit_log(event_type, created_at DESC);

COMMENT ON TABLE encryption_audit_log IS
'Audit trail for encryption-related events: setup, recovery code generation, key recovery, password changes';

-- RLS policies for encryption_audit_log
ALTER TABLE encryption_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can only read their own audit logs
CREATE POLICY "Users can read own audit logs"
ON encryption_audit_log
FOR SELECT
USING (auth.uid() = user_id);

-- Insert is done via service role only (API routes)
CREATE POLICY "Service role can insert audit logs"
ON encryption_audit_log
FOR INSERT
WITH CHECK (true);

-- Event types:
-- 'encryption_setup' - User completed initial encryption setup
-- 'recovery_codes_generated' - Recovery codes were generated
-- 'recovery_codes_viewed' - Recovery codes were viewed/downloaded
-- 'recovery_codes_delivered' - Recovery codes sent via email/other method
-- 'recovery_code_used' - A recovery code was used to recover access
-- 'encryption_password_changed' - User changed their encryption password
-- 'new_device_authorized' - A new device was authorized via QR code
-- 'recovery_codes_regenerated' - User regenerated their recovery codes
