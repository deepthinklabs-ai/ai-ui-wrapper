-- Migration: Add User Feature Preferences Table
-- Description: Stores user preferences for which chatbot features are enabled/disabled
-- Date: 2025-01-12

-- Create user_feature_preferences table
CREATE TABLE IF NOT EXISTS user_feature_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_feature_preferences_user_id
ON user_feature_preferences(user_id);

-- Enable Row Level Security
ALTER TABLE user_feature_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only read their own feature preferences
CREATE POLICY "Users can read own feature preferences"
  ON user_feature_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own feature preferences
CREATE POLICY "Users can insert own feature preferences"
  ON user_feature_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own feature preferences
CREATE POLICY "Users can update own feature preferences"
  ON user_feature_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own feature preferences
CREATE POLICY "Users can delete own feature preferences"
  ON user_feature_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_feature_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_user_feature_preferences_updated_at
  BEFORE UPDATE ON user_feature_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_user_feature_preferences_updated_at();

-- Comment on table
COMMENT ON TABLE user_feature_preferences IS 'Stores user preferences for enabled/disabled chatbot features';
COMMENT ON COLUMN user_feature_preferences.features IS 'JSONB object mapping feature IDs to boolean enabled/disabled state';
