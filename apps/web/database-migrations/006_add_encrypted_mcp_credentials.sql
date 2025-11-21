-- Migration: Add Encrypted MCP Credentials Storage
-- Phase 1 Security: Move credentials from localStorage to encrypted database storage
-- Created: 2025-11-16

-- Create table for encrypted MCP server credentials
CREATE TABLE IF NOT EXISTS mcp_server_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  server_id VARCHAR(255) NOT NULL,
  server_name VARCHAR(255) NOT NULL,
  server_type VARCHAR(50) NOT NULL CHECK (server_type IN ('stdio', 'sse')),

  -- Encrypted configuration (JSON encrypted with AES-256-GCM)
  encrypted_config TEXT NOT NULL,
  encryption_iv TEXT NOT NULL, -- Initialization vector for decryption

  -- Metadata
  enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one server per user per server_id
  CONSTRAINT unique_user_server UNIQUE (user_id, server_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mcp_credentials_user_id ON mcp_server_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_mcp_credentials_enabled ON mcp_server_credentials(user_id, enabled);

-- Enable Row Level Security
ALTER TABLE mcp_server_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own credentials
CREATE POLICY "Users can view own MCP credentials"
  ON mcp_server_credentials
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own MCP credentials"
  ON mcp_server_credentials
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own MCP credentials"
  ON mcp_server_credentials
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own MCP credentials"
  ON mcp_server_credentials
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mcp_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER mcp_credentials_updated_at
  BEFORE UPDATE ON mcp_server_credentials
  FOR EACH ROW
  EXECUTE FUNCTION update_mcp_credentials_updated_at();

-- Add comment for documentation
COMMENT ON TABLE mcp_server_credentials IS 'Stores encrypted MCP server credentials with AES-256-GCM encryption. Credentials are never stored in plaintext.';
COMMENT ON COLUMN mcp_server_credentials.encrypted_config IS 'JSON configuration encrypted with AES-256-GCM. Contains command, args, env, url depending on server type.';
COMMENT ON COLUMN mcp_server_credentials.encryption_iv IS 'Initialization vector (IV) used for AES-256-GCM encryption. Required for decryption.';
