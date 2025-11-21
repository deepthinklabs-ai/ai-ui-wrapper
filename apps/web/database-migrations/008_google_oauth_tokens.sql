-- ============================================================================
-- Google OAuth Tokens Storage - Database Schema Migration
-- ============================================================================
-- This migration creates tables for storing Google OAuth 2.0 tokens
-- ============================================================================

-- OAuth Connections table
CREATE TABLE IF NOT EXISTS oauth_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google')), -- Extensible for future providers
  provider_user_id TEXT NOT NULL, -- Google user ID
  provider_email TEXT NOT NULL,
  provider_name TEXT,
  provider_picture TEXT,

  -- Encrypted token storage
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT NOT NULL,
  token_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Scopes granted
  scopes TEXT[] NOT NULL,

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'expired')),

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used_at TIMESTAMP WITH TIME ZONE,

  -- Unique constraint: one connection per user per provider
  UNIQUE(user_id, provider)
);

-- Employee OAuth Access table
-- Links virtual employees to OAuth connections they're allowed to use
CREATE TABLE IF NOT EXISTS employee_oauth_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  virtual_employee_id UUID NOT NULL REFERENCES virtual_employees(id) ON DELETE CASCADE,
  oauth_connection_id UUID NOT NULL REFERENCES oauth_connections(id) ON DELETE CASCADE,

  -- Granular service access
  allowed_services JSONB DEFAULT '[]'::jsonb, -- ['gmail', 'drive', 'sheets', 'docs']

  -- Metadata
  granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id),

  -- Unique constraint: one access grant per employee per connection
  UNIQUE(virtual_employee_id, oauth_connection_id)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_oauth_connections_user_id ON oauth_connections(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_connections_provider ON oauth_connections(provider);
CREATE INDEX IF NOT EXISTS idx_oauth_connections_status ON oauth_connections(status);
CREATE INDEX IF NOT EXISTS idx_employee_oauth_access_employee_id ON employee_oauth_access(virtual_employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_oauth_access_connection_id ON employee_oauth_access(oauth_connection_id);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE oauth_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_oauth_access ENABLE ROW LEVEL SECURITY;

-- OAuth Connections: Users can only access their own connections
CREATE POLICY "Users can view their own OAuth connections" ON oauth_connections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own OAuth connections" ON oauth_connections
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own OAuth connections" ON oauth_connections
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own OAuth connections" ON oauth_connections
  FOR DELETE USING (auth.uid() = user_id);

-- Employee OAuth Access: Users can only manage access for their employees
CREATE POLICY "Users can view OAuth access for their employees" ON employee_oauth_access
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM virtual_employees ve
    JOIN teams t ON t.id = ve.team_id
    WHERE ve.id = employee_oauth_access.virtual_employee_id
    AND t.user_id = auth.uid()
  ));

CREATE POLICY "Users can grant OAuth access to their employees" ON employee_oauth_access
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM virtual_employees ve
    JOIN teams t ON t.id = ve.team_id
    WHERE ve.id = employee_oauth_access.virtual_employee_id
    AND t.user_id = auth.uid()
  ));

CREATE POLICY "Users can update OAuth access for their employees" ON employee_oauth_access
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM virtual_employees ve
    JOIN teams t ON t.id = ve.team_id
    WHERE ve.id = employee_oauth_access.virtual_employee_id
    AND t.user_id = auth.uid()
  ));

CREATE POLICY "Users can revoke OAuth access from their employees" ON employee_oauth_access
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM virtual_employees ve
    JOIN teams t ON t.id = ve.team_id
    WHERE ve.id = employee_oauth_access.virtual_employee_id
    AND t.user_id = auth.uid()
  ));

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor to create OAuth storage tables
-- ============================================================================
