-- Migration: Kill Switches / System Configuration
-- Description: Admin-controlled feature flags that can be toggled in real-time
--              without redeploying the application.
--
-- Kill Switches:
--   - master_kill_switch: Disables ALL AI API calls (emergency shutoff)
--   - ai_features_enabled: Enables/disables AI features (chat, completion, etc.)
--   - oauth_enabled: Enables/disables third-party OAuth connections
--   - new_signups_enabled: Enables/disables new user registrations
--   - payments_enabled: Enables/disables Stripe payments

-- Create system_config table for kill switches
CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create index on key for fast lookups
CREATE INDEX IF NOT EXISTS idx_system_config_key ON system_config(key);

-- Enable RLS
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

-- Policy: Only service role can modify system config (admin only)
-- Users cannot read or modify this table directly
CREATE POLICY "Service role full access"
  ON system_config
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_system_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_system_config_updated_at
  BEFORE UPDATE ON system_config
  FOR EACH ROW
  EXECUTE FUNCTION update_system_config_updated_at();

-- Insert default kill switch values (all features enabled by default)
INSERT INTO system_config (key, value, description) VALUES
  ('master_kill_switch', 'false'::jsonb, 'Emergency shutoff - disables ALL AI API calls. Use for cost control or security incidents.'),
  ('ai_features_enabled', 'true'::jsonb, 'Enables AI chat, completion, and related features. Disable to stop all AI usage.'),
  ('oauth_enabled', 'true'::jsonb, 'Enables third-party OAuth connections (Google, Slack, etc.). Disable if OAuth provider has issues.'),
  ('new_signups_enabled', 'true'::jsonb, 'Enables new user registrations. Disable to close signups temporarily.'),
  ('payments_enabled', 'true'::jsonb, 'Enables Stripe payment processing. Disable during Stripe issues or maintenance.')
ON CONFLICT (key) DO NOTHING;

-- Add comments
COMMENT ON TABLE system_config IS 'System-level configuration and kill switches. Admin-only access via service role.';
COMMENT ON COLUMN system_config.key IS 'Configuration key (e.g., master_kill_switch)';
COMMENT ON COLUMN system_config.value IS 'JSONB value - usually boolean for kill switches';
COMMENT ON COLUMN system_config.description IS 'Human-readable description of what this config does';
COMMENT ON COLUMN system_config.updated_by IS 'User ID of admin who last modified this setting';
