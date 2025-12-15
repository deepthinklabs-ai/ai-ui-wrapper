-- Migration: Add is_exposed column to canvas_nodes
-- Description: Adds an unencrypted is_exposed column for MASTER_TRIGGER nodes
--              so the exposed workflows API can query it without decrypting config
-- Created: 2025-12-15

-- ============================================================================
-- ADD is_exposed COLUMN
-- ============================================================================

-- Add the is_exposed column (nullable, defaults to false)
ALTER TABLE canvas_nodes
ADD COLUMN IF NOT EXISTS is_exposed BOOLEAN DEFAULT false;

-- Create index for efficient querying of exposed master triggers
CREATE INDEX IF NOT EXISTS idx_canvas_nodes_is_exposed
ON canvas_nodes(is_exposed)
WHERE is_exposed = true AND type = 'MASTER_TRIGGER';

-- ============================================================================
-- BACKFILL EXISTING DATA
-- ============================================================================

-- For any existing MASTER_TRIGGER nodes, try to extract is_exposed from config
-- This handles both encrypted (will skip) and unencrypted configs
UPDATE canvas_nodes
SET is_exposed = COALESCE((config->>'is_exposed')::boolean, false)
WHERE type = 'MASTER_TRIGGER'
  AND is_exposed IS NULL
  AND config IS NOT NULL
  AND config->>'is_exposed' IS NOT NULL;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN canvas_nodes.is_exposed IS
'For MASTER_TRIGGER nodes: whether this workflow is exposed in the Chatbot dropdown. Stored unencrypted to allow API querying without decryption.';
