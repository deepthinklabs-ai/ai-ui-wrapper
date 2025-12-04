-- Migration: Add encryption bundle to user profiles
-- Description: Stores the wrapped encryption key for client-side conversation encryption
-- Created: 2025-12-03

-- Add encryption_bundle column to user_profiles
-- This stores the PBKDF2 salt and wrapped data key (encrypted with password-derived key)
-- The server cannot decrypt this - only the client with the user's password can

ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS encryption_bundle JSONB DEFAULT NULL;

-- Comment explaining the structure
COMMENT ON COLUMN user_profiles.encryption_bundle IS
'Client-side encryption key bundle. Structure: {salt: string, wrappedDataKey: string, wrappedKeyIV: string}. Server cannot decrypt - only client with user password can.';

-- Index for checking if encryption is enabled (optional, for queries)
CREATE INDEX IF NOT EXISTS idx_user_profiles_encryption_enabled
ON user_profiles ((encryption_bundle IS NOT NULL));
