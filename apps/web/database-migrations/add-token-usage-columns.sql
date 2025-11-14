-- Migration: Add token usage tracking columns to messages table
-- Description: Adds input_tokens, output_tokens, and total_tokens columns
--              to store actual token usage from OpenAI and Anthropic APIs
-- Date: 2025-11-10

-- Add token usage columns to messages table
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS input_tokens INTEGER,
ADD COLUMN IF NOT EXISTS output_tokens INTEGER,
ADD COLUMN IF NOT EXISTS total_tokens INTEGER;

-- Add comments to document the columns
COMMENT ON COLUMN messages.input_tokens IS 'Number of tokens in the input/prompt (from API response)';
COMMENT ON COLUMN messages.output_tokens IS 'Number of tokens in the output/completion (from API response)';
COMMENT ON COLUMN messages.total_tokens IS 'Total tokens used (input + output, from API response)';

-- Create an index on total_tokens for analytics queries
CREATE INDEX IF NOT EXISTS idx_messages_total_tokens ON messages(total_tokens) WHERE total_tokens IS NOT NULL;

-- Note: These columns will be NULL for user messages and populated for assistant responses
