-- Migration: Add SSM_AGENT Node Type
-- Description: Add SSM_AGENT (State-Space Model) to canvas_nodes type check
-- Created: 2025-01-07

-- ============================================================================
-- UPDATE CANVAS_NODES TYPE CHECK CONSTRAINT
-- ============================================================================

-- Drop the existing constraint
ALTER TABLE canvas_nodes DROP CONSTRAINT IF EXISTS canvas_nodes_type_check;

-- Recreate with all node types including SSM_AGENT
ALTER TABLE canvas_nodes ADD CONSTRAINT canvas_nodes_type_check
CHECK (type IN (
  -- Original types
  'GENESIS_BOT',
  'TRAINING_SESSION',
  'BOARDROOM',
  'CABLE_CHANNEL',
  'TRIGGER',
  'TOOL',
  'TERMINAL_COMMAND',
  'CUSTOM',
  -- Added in previous migrations
  'MASTER_TRIGGER',
  'SMART_ROUTER',
  'RESPONSE_COMPILER',
  -- New type
  'SSM_AGENT'            -- State-Space Model agent for continuous monitoring
));

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON CONSTRAINT canvas_nodes_type_check ON canvas_nodes IS
'Allowed node types for canvas workflows. Includes SSM_AGENT for State-Space Model continuous monitoring.';
