-- Migration: Add New Canvas Node Types
-- Description: Add SMART_ROUTER, RESPONSE_COMPILER, and MASTER_TRIGGER to canvas_nodes type check
-- Created: 2025-12-02

-- ============================================================================
-- UPDATE CANVAS_NODES TYPE CHECK CONSTRAINT
-- ============================================================================

-- Drop the existing constraint
ALTER TABLE canvas_nodes DROP CONSTRAINT IF EXISTS canvas_nodes_type_check;

-- Recreate with all node types including new ones
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
  -- New types
  'MASTER_TRIGGER',      -- Master Trigger node for exposing workflows
  'SMART_ROUTER',        -- Smart Router for intelligent query routing
  'RESPONSE_COMPILER'    -- Response Compiler for aggregating multi-agent responses
));

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON CONSTRAINT canvas_nodes_type_check ON canvas_nodes IS
'Allowed node types for canvas workflows. Includes original types plus MASTER_TRIGGER, SMART_ROUTER, and RESPONSE_COMPILER.';
