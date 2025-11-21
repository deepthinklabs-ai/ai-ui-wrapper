-- Migration: Add MCP Tool Calling Support
-- Description: Adds columns to store tool calls and tool results in messages
-- Date: 2025-01-16

-- Add tool_calls and tool_results columns to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS tool_calls JSONB,
ADD COLUMN IF NOT EXISTS tool_results JSONB;

-- Add comments for documentation
COMMENT ON COLUMN messages.tool_calls IS 'Array of tool calls made by the LLM in this message (MCP tool calling)';
COMMENT ON COLUMN messages.tool_results IS 'Array of tool execution results corresponding to tool_calls (MCP tool calling)';

-- Create index on tool_calls for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_tool_calls ON messages USING GIN (tool_calls);

-- Create index on tool_results for faster queries
CREATE INDEX IF NOT EXISTS idx_messages_tool_results ON messages USING GIN (tool_results);
