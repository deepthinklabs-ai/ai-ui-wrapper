-- Migration: Enable RLS on tables missing row-level security
-- Description: Fix security vulnerability by enabling RLS on public tables
-- Created: 2025-12-16

-- ============================================================================
-- WORKFLOW EXECUTIONS
-- Access through canvas ownership
-- ============================================================================

ALTER TABLE workflow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view executions from own canvases"
  ON workflow_executions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM canvases
      WHERE canvases.id = workflow_executions.canvas_id
      AND canvases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert executions to own canvases"
  ON workflow_executions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM canvases
      WHERE canvases.id = workflow_executions.canvas_id
      AND canvases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update executions in own canvases"
  ON workflow_executions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM canvases
      WHERE canvases.id = workflow_executions.canvas_id
      AND canvases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete executions from own canvases"
  ON workflow_executions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM canvases
      WHERE canvases.id = workflow_executions.canvas_id
      AND canvases.user_id = auth.uid()
    )
  );

-- ============================================================================
-- BOARDROOM CONVERSATIONS
-- Access through canvas ownership
-- ============================================================================

ALTER TABLE boardroom_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view boardroom conversations from own canvases"
  ON boardroom_conversations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM canvases
      WHERE canvases.id = boardroom_conversations.canvas_id
      AND canvases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert boardroom conversations to own canvases"
  ON boardroom_conversations FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM canvases
      WHERE canvases.id = boardroom_conversations.canvas_id
      AND canvases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update boardroom conversations in own canvases"
  ON boardroom_conversations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM canvases
      WHERE canvases.id = boardroom_conversations.canvas_id
      AND canvases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete boardroom conversations from own canvases"
  ON boardroom_conversations FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM canvases
      WHERE canvases.id = boardroom_conversations.canvas_id
      AND canvases.user_id = auth.uid()
    )
  );

-- ============================================================================
-- BOARDROOM MESSAGES
-- Access through conversation -> canvas ownership
-- ============================================================================

ALTER TABLE boardroom_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view boardroom messages from own conversations"
  ON boardroom_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM boardroom_conversations bc
      JOIN canvases c ON c.id = bc.canvas_id
      WHERE bc.id = boardroom_messages.conversation_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert boardroom messages to own conversations"
  ON boardroom_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM boardroom_conversations bc
      JOIN canvases c ON c.id = bc.canvas_id
      WHERE bc.id = boardroom_messages.conversation_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update boardroom messages in own conversations"
  ON boardroom_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM boardroom_conversations bc
      JOIN canvases c ON c.id = bc.canvas_id
      WHERE bc.id = boardroom_messages.conversation_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete boardroom messages from own conversations"
  ON boardroom_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM boardroom_conversations bc
      JOIN canvases c ON c.id = bc.canvas_id
      WHERE bc.id = boardroom_messages.conversation_id
      AND c.user_id = auth.uid()
    )
  );

-- ============================================================================
-- TRAINING SESSION EXECUTIONS
-- Access through canvas ownership
-- ============================================================================

ALTER TABLE training_session_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view training executions from own canvases"
  ON training_session_executions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM canvases
      WHERE canvases.id = training_session_executions.canvas_id
      AND canvases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert training executions to own canvases"
  ON training_session_executions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM canvases
      WHERE canvases.id = training_session_executions.canvas_id
      AND canvases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update training executions in own canvases"
  ON training_session_executions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM canvases
      WHERE canvases.id = training_session_executions.canvas_id
      AND canvases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete training executions from own canvases"
  ON training_session_executions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM canvases
      WHERE canvases.id = training_session_executions.canvas_id
      AND canvases.user_id = auth.uid()
    )
  );

-- ============================================================================
-- TRAINING INTERACTIONS
-- Access through execution -> canvas ownership
-- ============================================================================

ALTER TABLE training_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view training interactions from own executions"
  ON training_interactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM training_session_executions tse
      JOIN canvases c ON c.id = tse.canvas_id
      WHERE tse.id = training_interactions.execution_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert training interactions to own executions"
  ON training_interactions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM training_session_executions tse
      JOIN canvases c ON c.id = tse.canvas_id
      WHERE tse.id = training_interactions.execution_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update training interactions in own executions"
  ON training_interactions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM training_session_executions tse
      JOIN canvases c ON c.id = tse.canvas_id
      WHERE tse.id = training_interactions.execution_id
      AND c.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete training interactions from own executions"
  ON training_interactions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM training_session_executions tse
      JOIN canvases c ON c.id = tse.canvas_id
      WHERE tse.id = training_interactions.execution_id
      AND c.user_id = auth.uid()
    )
  );

-- ============================================================================
-- MODEL RATE LIMITS
-- Read-only configuration table - users can view limits but not modify
-- ============================================================================

ALTER TABLE model_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view rate limits"
  ON model_rate_limits FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policies - only admins via service role can modify

-- ============================================================================
-- USER DAILY USAGE
-- Users can only access their own usage data
-- ============================================================================

ALTER TABLE user_daily_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily usage"
  ON user_daily_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily usage"
  ON user_daily_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily usage"
  ON user_daily_usage FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own daily usage"
  ON user_daily_usage FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- USER MINUTE USAGE
-- Users can only access their own usage data
-- ============================================================================

ALTER TABLE user_minute_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own minute usage"
  ON user_minute_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own minute usage"
  ON user_minute_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own minute usage"
  ON user_minute_usage FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own minute usage"
  ON user_minute_usage FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Users can view executions from own canvases" ON workflow_executions IS 'RLS: Users can only view workflow executions from canvases they own';
COMMENT ON POLICY "Users can view boardroom conversations from own canvases" ON boardroom_conversations IS 'RLS: Users can only view boardroom conversations from canvases they own';
COMMENT ON POLICY "Users can view boardroom messages from own conversations" ON boardroom_messages IS 'RLS: Users can only view boardroom messages from conversations they own';
COMMENT ON POLICY "Users can view training executions from own canvases" ON training_session_executions IS 'RLS: Users can only view training executions from canvases they own';
COMMENT ON POLICY "Users can view training interactions from own executions" ON training_interactions IS 'RLS: Users can only view training interactions from executions they own';
COMMENT ON POLICY "Anyone can view rate limits" ON model_rate_limits IS 'RLS: Rate limits are public configuration, read-only for users';
COMMENT ON POLICY "Users can view own daily usage" ON user_daily_usage IS 'RLS: Users can only access their own daily usage data';
COMMENT ON POLICY "Users can view own minute usage" ON user_minute_usage IS 'RLS: Users can only access their own minute usage data';
