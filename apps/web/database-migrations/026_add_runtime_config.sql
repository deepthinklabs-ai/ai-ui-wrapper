-- Migration: Add runtime_config column to canvas_nodes
-- Description: Store non-sensitive config fields unencrypted for server-side access
-- This allows workflow triggers to access model_provider, model_name, and integration flags
-- even when the main config is encrypted client-side.

-- Add runtime_config column
ALTER TABLE public.canvas_nodes
ADD COLUMN IF NOT EXISTS runtime_config JSONB DEFAULT '{}'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN public.canvas_nodes.runtime_config IS
'Non-sensitive config fields stored unencrypted for server-side workflow access. Includes: model_provider, model_name, gmail.enabled, calendar.enabled, sheets.enabled, docs.enabled, slack.enabled';

-- Create index for querying by model_provider
CREATE INDEX IF NOT EXISTS idx_canvas_nodes_runtime_config_provider
ON public.canvas_nodes ((runtime_config->>'model_provider'));
