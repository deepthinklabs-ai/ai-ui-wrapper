-- Migration: Rate Limiting for Pro Users
-- Description: Per-model rate limits with daily reset at midnight EST
-- Created: 2025-12-02

-- ============================================================================
-- MODEL RATE LIMITS TABLE
-- ============================================================================
-- Defines rate limits per tier per model

CREATE TABLE IF NOT EXISTS model_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT NOT NULL,                           -- 'pro', 'enterprise', etc.
  model_name TEXT NOT NULL,                     -- 'gpt-5.1', 'claude-sonnet-4-5', etc.
  daily_requests INTEGER NOT NULL,              -- Max requests per day
  daily_tokens INTEGER NOT NULL,                -- Max tokens per day
  requests_per_minute INTEGER NOT NULL,         -- Burst limit
  warning_threshold DECIMAL DEFAULT 0.8,        -- 80% = show warning
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tier, model_name)
);

-- ============================================================================
-- USER DAILY USAGE TABLE
-- ============================================================================
-- Tracks usage per user per model per day (EST timezone)

CREATE TABLE IF NOT EXISTS user_daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  usage_date DATE NOT NULL,                     -- Date in EST
  request_count INTEGER DEFAULT 0,
  token_count INTEGER DEFAULT 0,
  last_request_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, model_name, usage_date)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_daily_usage_lookup
ON user_daily_usage(user_id, model_name, usage_date);

-- Index for cleanup of old records
CREATE INDEX IF NOT EXISTS idx_user_daily_usage_date
ON user_daily_usage(usage_date);

-- ============================================================================
-- MINUTE-LEVEL RATE TRACKING TABLE
-- ============================================================================
-- For requests-per-minute tracking

CREATE TABLE IF NOT EXISTS user_minute_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_name TEXT NOT NULL,
  minute_bucket TIMESTAMPTZ NOT NULL,           -- Truncated to minute
  request_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, model_name, minute_bucket)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_minute_usage_lookup
ON user_minute_usage(user_id, model_name, minute_bucket);

-- ============================================================================
-- DEFAULT RATE LIMITS FOR PRO TIER
-- ============================================================================

-- OpenAI GPT-5.1 models (premium pricing)
-- GPT-5.1 flagship is expensive, mini/nano are cost-effective
INSERT INTO model_rate_limits (tier, model_name, daily_requests, daily_tokens, requests_per_minute, warning_threshold)
VALUES
  ('pro', 'gpt-5.1', 300, 350000, 15, 0.8),       -- Premium model - moderate limits
  ('pro', 'gpt-5.1-mini', 1000, 750000, 30, 0.8), -- Good balance
  ('pro', 'gpt-5.1-nano', 2000, 1000000, 40, 0.8) -- Most cost-effective
ON CONFLICT (tier, model_name) DO NOTHING;

-- OpenAI GPT-4 models (moderate pricing)
INSERT INTO model_rate_limits (tier, model_name, daily_requests, daily_tokens, requests_per_minute, warning_threshold)
VALUES
  ('pro', 'gpt-4o', 750, 600000, 25, 0.8),
  ('pro', 'gpt-4o-mini', 1500, 1000000, 40, 0.8),
  ('pro', 'gpt-4-turbo', 500, 500000, 20, 0.8),
  ('pro', 'gpt-3.5-turbo', 3000, 2000000, 60, 0.8)
ON CONFLICT (tier, model_name) DO NOTHING;

-- Claude models (Anthropic)
-- Note: Opus is very expensive ($15/$75 per 1M tokens), so limits are conservative
INSERT INTO model_rate_limits (tier, model_name, daily_requests, daily_tokens, requests_per_minute, warning_threshold)
VALUES
  ('pro', 'claude-sonnet-4-5', 400, 400000, 20, 0.8),
  ('pro', 'claude-sonnet-4', 500, 500000, 25, 0.8),
  ('pro', 'claude-opus-4-1', 100, 150000, 10, 0.8),  -- Very expensive model - limited
  ('pro', 'claude-haiku-4-5', 1500, 1000000, 40, 0.8),
  ('pro', 'claude-haiku-3-5', 2000, 1500000, 50, 0.8)
ON CONFLICT (tier, model_name) DO NOTHING;

-- Grok models (xAI) - Premium pricing similar to GPT-5.1
INSERT INTO model_rate_limits (tier, model_name, daily_requests, daily_tokens, requests_per_minute, warning_threshold)
VALUES
  ('pro', 'grok-4-fast-reasoning', 300, 350000, 15, 0.8),
  ('pro', 'grok-4-fast-non-reasoning', 500, 500000, 25, 0.8),
  ('pro', 'grok-4-1-fast-reasoning', 300, 350000, 15, 0.8),
  ('pro', 'grok-4-1-fast-non-reasoning', 500, 500000, 25, 0.8),
  ('pro', 'grok-code-fast-1', 750, 600000, 30, 0.8)
ON CONFLICT (tier, model_name) DO NOTHING;

-- ============================================================================
-- CLEANUP FUNCTION
-- ============================================================================
-- Function to clean up old usage records (run daily via cron)

CREATE OR REPLACE FUNCTION cleanup_old_usage_records()
RETURNS void AS $$
BEGIN
  -- Delete daily usage older than 90 days
  DELETE FROM user_daily_usage
  WHERE usage_date < CURRENT_DATE - INTERVAL '90 days';

  -- Delete minute usage older than 1 hour
  DELETE FROM user_minute_usage
  WHERE minute_bucket < NOW() - INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE model_rate_limits IS 'Per-model rate limits for each subscription tier';
COMMENT ON TABLE user_daily_usage IS 'Daily usage tracking per user per model (resets at midnight EST)';
COMMENT ON TABLE user_minute_usage IS 'Per-minute usage tracking for burst rate limiting';
COMMENT ON FUNCTION cleanup_old_usage_records IS 'Cleans up old usage records - run via pg_cron daily';
