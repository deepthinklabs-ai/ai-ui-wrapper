-- ============================================================================
-- Workforce Feature - Database Schema Migration
-- ============================================================================
-- This migration creates tables for The Workforce feature:
-- Virtual Employees that work together as teams to achieve goals
-- ============================================================================

-- Teams table
CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  mission_statement TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Virtual Employees table
CREATE TABLE IF NOT EXISTS virtual_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'nonbinary')),
  title TEXT NOT NULL,
  role_description TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  model_provider TEXT NOT NULL,
  model_name TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  allowed_tools JSONB DEFAULT '[]'::jsonb,
  oauth_connections JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'training', 'working', 'waiting')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Training Sessions table
CREATE TABLE IF NOT EXISTS training_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  virtual_employee_id UUID NOT NULL REFERENCES virtual_employees(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  summary TEXT,
  prompt_updates TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Training Messages table
CREATE TABLE IF NOT EXISTS training_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  attachments JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Instruction Sessions table
CREATE TABLE IF NOT EXISTS instruction_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  virtual_employee_id UUID NOT NULL REFERENCES virtual_employees(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Instruction Messages table
CREATE TABLE IF NOT EXISTS instruction_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instruction_session_id UUID NOT NULL REFERENCES instruction_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Inter-Employee Messages table
CREATE TABLE IF NOT EXISTS inter_employee_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  from_employee_id UUID NOT NULL REFERENCES virtual_employees(id) ON DELETE CASCADE,
  to_employee_id UUID NOT NULL REFERENCES virtual_employees(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL CHECK (message_type IN ('report', 'handoff', 'question')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_teams_user_id ON teams(user_id);
CREATE INDEX IF NOT EXISTS idx_virtual_employees_team_id ON virtual_employees(team_id);
CREATE INDEX IF NOT EXISTS idx_virtual_employees_status ON virtual_employees(status);
CREATE INDEX IF NOT EXISTS idx_training_sessions_employee_id ON training_sessions(virtual_employee_id);
CREATE INDEX IF NOT EXISTS idx_training_sessions_team_id ON training_sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_training_messages_session_id ON training_messages(training_session_id);
CREATE INDEX IF NOT EXISTS idx_instruction_sessions_employee_id ON instruction_sessions(virtual_employee_id);
CREATE INDEX IF NOT EXISTS idx_instruction_sessions_team_id ON instruction_sessions(team_id);
CREATE INDEX IF NOT EXISTS idx_instruction_messages_session_id ON instruction_messages(instruction_session_id);
CREATE INDEX IF NOT EXISTS idx_inter_employee_messages_team_id ON inter_employee_messages(team_id);
CREATE INDEX IF NOT EXISTS idx_inter_employee_messages_from_employee ON inter_employee_messages(from_employee_id);
CREATE INDEX IF NOT EXISTS idx_inter_employee_messages_to_employee ON inter_employee_messages(to_employee_id);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE virtual_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE training_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE instruction_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE instruction_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE inter_employee_messages ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Teams: Users can only access their own teams
CREATE POLICY "Users can view their own teams" ON teams
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own teams" ON teams
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own teams" ON teams
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own teams" ON teams
  FOR DELETE USING (auth.uid() = user_id);

-- Virtual Employees: Users can access employees in their teams
CREATE POLICY "Users can view employees in their teams" ON virtual_employees
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM teams WHERE teams.id = virtual_employees.team_id AND teams.user_id = auth.uid()
  ));

CREATE POLICY "Users can create employees in their teams" ON virtual_employees
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM teams WHERE teams.id = virtual_employees.team_id AND teams.user_id = auth.uid()
  ));

CREATE POLICY "Users can update employees in their teams" ON virtual_employees
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM teams WHERE teams.id = virtual_employees.team_id AND teams.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete employees in their teams" ON virtual_employees
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM teams WHERE teams.id = virtual_employees.team_id AND teams.user_id = auth.uid()
  ));

-- Training Sessions: Users can access sessions for their employees
CREATE POLICY "Users can view training sessions for their employees" ON training_sessions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM teams WHERE teams.id = training_sessions.team_id AND teams.user_id = auth.uid()
  ));

CREATE POLICY "Users can create training sessions for their employees" ON training_sessions
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM teams WHERE teams.id = training_sessions.team_id AND teams.user_id = auth.uid()
  ));

CREATE POLICY "Users can update training sessions for their employees" ON training_sessions
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM teams WHERE teams.id = training_sessions.team_id AND teams.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete training sessions for their employees" ON training_sessions
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM teams WHERE teams.id = training_sessions.team_id AND teams.user_id = auth.uid()
  ));

-- Training Messages: Users can access messages in their training sessions
CREATE POLICY "Users can view training messages" ON training_messages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM training_sessions ts
    JOIN teams t ON t.id = ts.team_id
    WHERE ts.id = training_messages.training_session_id AND t.user_id = auth.uid()
  ));

CREATE POLICY "Users can create training messages" ON training_messages
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM training_sessions ts
    JOIN teams t ON t.id = ts.team_id
    WHERE ts.id = training_messages.training_session_id AND t.user_id = auth.uid()
  ));

-- Instruction Sessions: Users can access instruction sessions for their employees
CREATE POLICY "Users can view instruction sessions" ON instruction_sessions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM teams WHERE teams.id = instruction_sessions.team_id AND teams.user_id = auth.uid()
  ));

CREATE POLICY "Users can create instruction sessions" ON instruction_sessions
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM teams WHERE teams.id = instruction_sessions.team_id AND teams.user_id = auth.uid()
  ));

CREATE POLICY "Users can update instruction sessions" ON instruction_sessions
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM teams WHERE teams.id = instruction_sessions.team_id AND teams.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete instruction sessions" ON instruction_sessions
  FOR DELETE USING (EXISTS (
    SELECT 1 FROM teams WHERE teams.id = instruction_sessions.team_id AND teams.user_id = auth.uid()
  ));

-- Instruction Messages: Users can access messages in their instruction sessions
CREATE POLICY "Users can view instruction messages" ON instruction_messages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM instruction_sessions ins
    JOIN teams t ON t.id = ins.team_id
    WHERE ins.id = instruction_messages.instruction_session_id AND t.user_id = auth.uid()
  ));

CREATE POLICY "Users can create instruction messages" ON instruction_messages
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM instruction_sessions ins
    JOIN teams t ON t.id = ins.team_id
    WHERE ins.id = instruction_messages.instruction_session_id AND t.user_id = auth.uid()
  ));

-- Inter-Employee Messages: Users can access messages in their teams
CREATE POLICY "Users can view inter-employee messages" ON inter_employee_messages
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM teams WHERE teams.id = inter_employee_messages.team_id AND teams.user_id = auth.uid()
  ));

CREATE POLICY "Users can create inter-employee messages" ON inter_employee_messages
  FOR INSERT WITH CHECK (EXISTS (
    SELECT 1 FROM teams WHERE teams.id = inter_employee_messages.team_id AND teams.user_id = auth.uid()
  ));

-- ============================================================================
-- Migration Complete
-- ============================================================================
-- Run this SQL in your Supabase SQL Editor to create all tables and policies
-- ============================================================================
