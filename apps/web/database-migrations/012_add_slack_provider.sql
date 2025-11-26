-- ============================================================================
-- Add Slack as OAuth Provider - Database Schema Migration
-- ============================================================================
-- This migration updates the oauth_connections provider check constraint
-- to include 'slack' as a valid provider value
-- ============================================================================

-- Drop the existing provider check constraint
ALTER TABLE oauth_connections DROP CONSTRAINT IF EXISTS oauth_connections_provider_check;

-- Add updated constraint that includes both 'google' and 'slack'
ALTER TABLE oauth_connections ADD CONSTRAINT oauth_connections_provider_check
  CHECK (provider IN ('google', 'slack'));

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor to enable Slack OAuth storage
-- ============================================================================
