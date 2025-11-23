-- Migration: Canvas Workflow System
-- Description: n8n-style visual workflow builder for orchestrating Genesis Bots,
--              Training Sessions, Boardrooms, and other features
-- Created: 2025-11-21

-- ============================================================================
-- CANVASES (Main workflows/boards)
-- ============================================================================

CREATE TABLE IF NOT EXISTS canvases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  mode VARCHAR(50) NOT NULL CHECK (mode IN ('workflow', 'boardroom', 'hybrid')),
  thumbnail_url TEXT,
  is_template BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_canvases_user_id ON canvases(user_id);
CREATE INDEX idx_canvases_is_template ON canvases(is_template) WHERE is_template = true;

-- ============================================================================
-- CANVAS NODES
-- ============================================================================

CREATE TABLE IF NOT EXISTS canvas_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN (
    'GENESIS_BOT',
    'TRAINING_SESSION',
    'BOARDROOM',
    'CABLE_CHANNEL',
    'TRIGGER',
    'TOOL',
    'TERMINAL_COMMAND',
    'CUSTOM'
  )),
  position_x FLOAT NOT NULL,
  position_y FLOAT NOT NULL,
  label VARCHAR(255) NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_canvas_nodes_canvas_id ON canvas_nodes(canvas_id);
CREATE INDEX idx_canvas_nodes_type ON canvas_nodes(type);

-- ============================================================================
-- CANVAS EDGES (Connections between nodes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS canvas_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  from_node_id UUID NOT NULL REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  from_port VARCHAR(100),
  to_node_id UUID NOT NULL REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  to_port VARCHAR(100),
  label VARCHAR(255),
  animated BOOLEAN DEFAULT false,
  condition TEXT, -- Expression to evaluate
  transform TEXT, -- Data transformation logic
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_canvas_edges_canvas_id ON canvas_edges(canvas_id);
CREATE INDEX idx_canvas_edges_from_node ON canvas_edges(from_node_id);
CREATE INDEX idx_canvas_edges_to_node ON canvas_edges(to_node_id);

-- ============================================================================
-- WORKFLOW EXECUTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL CHECK (status IN ('idle', 'running', 'paused', 'completed', 'failed')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  error TEXT,
  node_states JSONB NOT NULL DEFAULT '{}',
  final_output JSONB,
  execution_log JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_executions_canvas_id ON workflow_executions(canvas_id);
CREATE INDEX idx_workflow_executions_status ON workflow_executions(status);
CREATE INDEX idx_workflow_executions_started_at ON workflow_executions(started_at DESC);

-- ============================================================================
-- BOARDROOM CONVERSATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS boardroom_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  boardroom_node_id UUID NOT NULL REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'completed', 'cancelled')),
  current_round INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  participants JSONB NOT NULL DEFAULT '[]',
  summary TEXT,
  decision TEXT,
  votes JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_boardroom_conversations_node_id ON boardroom_conversations(boardroom_node_id);
CREATE INDEX idx_boardroom_conversations_canvas_id ON boardroom_conversations(canvas_id);
CREATE INDEX idx_boardroom_conversations_status ON boardroom_conversations(status);

-- ============================================================================
-- BOARDROOM MESSAGES
-- ============================================================================

CREATE TABLE IF NOT EXISTS boardroom_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES boardroom_conversations(id) ON DELETE CASCADE,
  participant_node_id UUID NOT NULL REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  round INTEGER NOT NULL,
  message_references UUID[], -- Array of message IDs (renamed from 'references' to avoid keyword conflict)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_boardroom_messages_conversation_id ON boardroom_messages(conversation_id);
CREATE INDEX idx_boardroom_messages_round ON boardroom_messages(round);

-- ============================================================================
-- TRAINING SESSION EXECUTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS training_session_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_node_id UUID NOT NULL REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  genesis_bot_node_id UUID NOT NULL REFERENCES canvas_nodes(id) ON DELETE CASCADE,
  canvas_id UUID NOT NULL REFERENCES canvases(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'completed', 'cancelled')),
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  original_system_prompt TEXT NOT NULL,
  updated_system_prompt TEXT,
  training_summary TEXT,
  improvements TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_training_executions_training_node_id ON training_session_executions(training_node_id);
CREATE INDEX idx_training_executions_genesis_bot_node_id ON training_session_executions(genesis_bot_node_id);
CREATE INDEX idx_training_executions_status ON training_session_executions(status);

-- ============================================================================
-- TRAINING INTERACTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS training_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  execution_id UUID NOT NULL REFERENCES training_session_executions(id) ON DELETE CASCADE,
  user_message TEXT NOT NULL,
  bot_response TEXT NOT NULL,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_training_interactions_execution_id ON training_interactions(execution_id);

-- ============================================================================
-- CANVAS TEMPLATES
-- ============================================================================

CREATE TABLE IF NOT EXISTS canvas_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN ('research', 'content', 'analysis', 'automation', 'custom')),
  thumbnail_url TEXT,
  template_data JSONB NOT NULL, -- Contains nodes and edges
  is_official BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uses_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_canvas_templates_category ON canvas_templates(category);
CREATE INDEX idx_canvas_templates_official ON canvas_templates(is_official) WHERE is_official = true;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Canvases
ALTER TABLE canvases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own canvases"
  ON canvases FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own canvases"
  ON canvases FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own canvases"
  ON canvases FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own canvases"
  ON canvases FOR DELETE
  USING (auth.uid() = user_id);

-- Canvas Nodes (inherit from canvas ownership)
ALTER TABLE canvas_nodes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view nodes from own canvases"
  ON canvas_nodes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM canvases
      WHERE canvases.id = canvas_nodes.canvas_id
      AND canvases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert nodes to own canvases"
  ON canvas_nodes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM canvases
      WHERE canvases.id = canvas_nodes.canvas_id
      AND canvases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update nodes in own canvases"
  ON canvas_nodes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM canvases
      WHERE canvases.id = canvas_nodes.canvas_id
      AND canvases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete nodes from own canvases"
  ON canvas_nodes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM canvases
      WHERE canvases.id = canvas_nodes.canvas_id
      AND canvases.user_id = auth.uid()
    )
  );

-- Canvas Edges (inherit from canvas ownership)
ALTER TABLE canvas_edges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view edges from own canvases"
  ON canvas_edges FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM canvases
      WHERE canvases.id = canvas_edges.canvas_id
      AND canvases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert edges to own canvases"
  ON canvas_edges FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM canvases
      WHERE canvases.id = canvas_edges.canvas_id
      AND canvases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update edges in own canvases"
  ON canvas_edges FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM canvases
      WHERE canvases.id = canvas_edges.canvas_id
      AND canvases.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete edges from own canvases"
  ON canvas_edges FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM canvases
      WHERE canvases.id = canvas_edges.canvas_id
      AND canvases.user_id = auth.uid()
    )
  );

-- Templates (public read, admin write)
ALTER TABLE canvas_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view templates"
  ON canvas_templates FOR SELECT
  USING (true);

CREATE POLICY "Users can create templates"
  ON canvas_templates FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Other tables inherit RLS from parent relationships

-- ============================================================================
-- TRIGGERS FOR updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_canvas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER canvases_updated_at
  BEFORE UPDATE ON canvases
  FOR EACH ROW
  EXECUTE FUNCTION update_canvas_updated_at();

CREATE TRIGGER canvas_nodes_updated_at
  BEFORE UPDATE ON canvas_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_canvas_updated_at();

CREATE TRIGGER canvas_templates_updated_at
  BEFORE UPDATE ON canvas_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_canvas_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE canvases IS 'Canvas workflows - visual orchestration of Genesis Bots and features';
COMMENT ON TABLE canvas_nodes IS 'Nodes in a canvas - Genesis Bots, Training Sessions, Boardrooms, etc.';
COMMENT ON TABLE canvas_edges IS 'Connections between canvas nodes';
COMMENT ON TABLE workflow_executions IS 'Runtime state of workflow executions';
COMMENT ON TABLE boardroom_conversations IS 'Multi-bot collaborative discussions';
COMMENT ON TABLE training_session_executions IS 'Training sessions for refining bot prompts';
COMMENT ON TABLE canvas_templates IS 'Pre-built canvas templates for common workflows';
