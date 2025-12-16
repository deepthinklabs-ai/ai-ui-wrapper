-- Migration: 021_chatbot_files.sql
-- Description: Add chatbot configurations and folders for .chatbot file system
-- Date: 2025-12-15

-- ============================================================================
-- CHATBOT FOLDERS TABLE (must be created first for foreign key reference)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chatbot_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.chatbot_folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  position INTEGER DEFAULT 0,
  is_collapsed BOOLEAN DEFAULT false,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for chatbot_folders
CREATE INDEX IF NOT EXISTS idx_chatbot_folders_user_id ON public.chatbot_folders(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbot_folders_parent_id ON public.chatbot_folders(parent_id);

-- ============================================================================
-- CHATBOTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.chatbots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  folder_id UUID REFERENCES public.chatbot_folders(id) ON DELETE SET NULL,
  position INTEGER DEFAULT 0,

  -- Configuration stored as JSONB for flexibility
  -- Includes: model settings, system_prompt, features, oauth_requirements, voice_id, step_by_step modes
  config JSONB NOT NULL DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for chatbots
CREATE INDEX IF NOT EXISTS idx_chatbots_user_id ON public.chatbots(user_id);
CREATE INDEX IF NOT EXISTS idx_chatbots_folder_id ON public.chatbots(folder_id);

-- ============================================================================
-- THREAD-CHATBOT ASSOCIATION
-- ============================================================================

-- Add chatbot_id column to threads table for switchable association
ALTER TABLE public.threads
ADD COLUMN IF NOT EXISTS chatbot_id UUID REFERENCES public.chatbots(id) ON DELETE SET NULL;

-- Index for thread-chatbot lookups
CREATE INDEX IF NOT EXISTS idx_threads_chatbot_id ON public.threads(chatbot_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.chatbots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_folders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can manage own chatbots" ON public.chatbots;
DROP POLICY IF EXISTS "Users can manage own chatbot folders" ON public.chatbot_folders;

-- Users can only access their own chatbots
CREATE POLICY "Users can manage own chatbots" ON public.chatbots
  FOR ALL USING (auth.uid() = user_id);

-- Users can only access their own chatbot folders
CREATE POLICY "Users can manage own chatbot folders" ON public.chatbot_folders
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================

-- Function to auto-update updated_at timestamp (if not already exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for chatbots table
DROP TRIGGER IF EXISTS update_chatbots_updated_at ON public.chatbots;
CREATE TRIGGER update_chatbots_updated_at
  BEFORE UPDATE ON public.chatbots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for chatbot_folders table
DROP TRIGGER IF EXISTS update_chatbot_folders_updated_at ON public.chatbot_folders;
CREATE TRIGGER update_chatbot_folders_updated_at
  BEFORE UPDATE ON public.chatbot_folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
