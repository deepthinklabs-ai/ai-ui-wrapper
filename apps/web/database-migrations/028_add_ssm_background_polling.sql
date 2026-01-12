-- Migration: Add SSM Background Polling Support
-- Description: Add columns for server-side encrypted config and background polling audit fields
-- Version: 028

-- Add server-side encrypted config column
-- This stores SSM operational data (rules, auto-reply, polling settings)
-- encrypted with a server-managed key for background cron job access
ALTER TABLE canvas_nodes
ADD COLUMN IF NOT EXISTS server_config_encrypted TEXT;

COMMENT ON COLUMN canvas_nodes.server_config_encrypted IS 'SSM operational data encrypted with server-managed key (AES-256-GCM). Contains rules, auto-reply config, polling settings. Accessible by cron jobs.';

-- Add background polling enabled flag
-- Cron job only processes nodes where this is true
ALTER TABLE canvas_nodes
ADD COLUMN IF NOT EXISTS background_polling_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN canvas_nodes.background_polling_enabled IS 'Whether background polling is enabled for this SSM node. Cron skips nodes where this is false.';

-- Add audit fields for server config sync
ALTER TABLE canvas_nodes
ADD COLUMN IF NOT EXISTS server_config_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN canvas_nodes.server_config_updated_at IS 'Timestamp when server_config_encrypted was last updated from client.';

-- Add version for optimistic locking
ALTER TABLE canvas_nodes
ADD COLUMN IF NOT EXISTS server_config_version INTEGER DEFAULT 0;

COMMENT ON COLUMN canvas_nodes.server_config_version IS 'Version number for optimistic locking of server config updates. Incremented on each sync.';

-- Add last poll timestamp for tracking
ALTER TABLE canvas_nodes
ADD COLUMN IF NOT EXISTS last_background_poll_at TIMESTAMPTZ;

COMMENT ON COLUMN canvas_nodes.last_background_poll_at IS 'Timestamp of last successful background poll by cron job.';

-- Add poll error field for debugging
ALTER TABLE canvas_nodes
ADD COLUMN IF NOT EXISTS background_poll_error TEXT;

COMMENT ON COLUMN canvas_nodes.background_poll_error IS 'Last background poll error message (null if last poll was successful).';

-- Create index for efficient cron job queries
-- Only fetch nodes where background polling is enabled
CREATE INDEX IF NOT EXISTS idx_canvas_nodes_background_polling
ON canvas_nodes (background_polling_enabled)
WHERE background_polling_enabled = true;

-- Create index for user-based queries (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_canvas_nodes_background_polling_user
ON canvas_nodes (user_id, background_polling_enabled)
WHERE background_polling_enabled = true;

-- Add RLS policy for server config columns
-- Only node owner can read/write their server config
-- Note: Cron job uses service role which bypasses RLS

-- Policy already exists for canvas_nodes table from previous migrations
-- The existing policies handle user_id checks

-- Grant permissions for service role (used by cron)
-- Service role needs to read server_config_encrypted and update audit fields
-- This is handled by Supabase service role key which bypasses RLS

-- Verify columns exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'canvas_nodes'
        AND column_name = 'server_config_encrypted'
    ) THEN
        RAISE EXCEPTION 'Migration failed: server_config_encrypted column not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'canvas_nodes'
        AND column_name = 'background_polling_enabled'
    ) THEN
        RAISE EXCEPTION 'Migration failed: background_polling_enabled column not created';
    END IF;

    RAISE NOTICE 'Migration 028_add_ssm_background_polling completed successfully';
END $$;
