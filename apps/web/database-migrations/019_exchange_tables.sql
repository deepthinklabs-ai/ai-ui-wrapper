-- ============================================================================
-- Exchange Tables Migration
--
-- Creates tables for the Exchange marketplace feature where users can post,
-- test, and download chatbots with their configurations.
-- ============================================================================

-- ============================================================================
-- EXCHANGE POSTS (Main marketplace listings)
-- ============================================================================
CREATE TABLE IF NOT EXISTS exchange_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,

  -- Files (stored as JSONB - immutable after creation)
  chatbot_file JSONB,           -- .chatbot file contents
  canvas_file JSONB,            -- .canvas file contents
  thread_file JSONB,            -- .thread file contents

  -- Stats
  download_count INTEGER DEFAULT 0,
  test_count INTEGER DEFAULT 0,

  -- Visibility
  is_published BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- EXCHANGE CATEGORIES (Predefined categories)
-- ============================================================================
CREATE TABLE IF NOT EXISTS exchange_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-populate categories
INSERT INTO exchange_categories (name, display_name, description, icon, sort_order) VALUES
  ('general', 'General', 'General purpose chatbots', 'chat', 1),
  ('coding', 'Coding', 'Programming and development assistants', 'code', 2),
  ('image', 'Image', 'Image generation and editing', 'image', 3),
  ('video', 'Video', 'Video creation and editing', 'video', 4),
  ('writing', 'Writing', 'Content writing and editing', 'pencil', 5),
  ('research', 'Research', 'Research and analysis', 'search', 6),
  ('productivity', 'Productivity', 'Task management and automation', 'clock', 7),
  ('education', 'Education', 'Learning and teaching', 'book', 8),
  ('business', 'Business', 'Business and professional use', 'briefcase', 9),
  ('creative', 'Creative', 'Art and creative projects', 'palette', 10)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- POST-CATEGORY MAPPING (Many-to-many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS exchange_post_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES exchange_posts(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES exchange_categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, category_id)
);

-- ============================================================================
-- EXCHANGE TAGS (User-created tags)
-- ============================================================================
CREATE TABLE IF NOT EXISTS exchange_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL UNIQUE,
  use_count INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- POST-TAG MAPPING (Many-to-many)
-- ============================================================================
CREATE TABLE IF NOT EXISTS exchange_post_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES exchange_posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES exchange_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, tag_id)
);

-- ============================================================================
-- EXCHANGE DOWNLOADS (Track who downloaded what)
-- ============================================================================
CREATE TABLE IF NOT EXISTS exchange_downloads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES exchange_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_type VARCHAR(20) NOT NULL CHECK (file_type IN ('chatbot', 'canvas', 'thread', 'bundle')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- SANDBOX SESSIONS (Session-only testing)
-- ============================================================================
CREATE TABLE IF NOT EXISTS exchange_sandbox_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES exchange_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages JSONB DEFAULT '[]'::jsonb,  -- Ephemeral messages
  last_query_at TIMESTAMPTZ,           -- For rate limiting (30 sec between queries)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- ============================================================================
-- BOT-TO-BOT QUERIES (Rate limited)
-- ============================================================================
CREATE TABLE IF NOT EXISTS exchange_bot_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_post_id UUID NOT NULL REFERENCES exchange_posts(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  response TEXT,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_exchange_posts_user_id ON exchange_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_exchange_posts_published ON exchange_posts(is_published) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_exchange_posts_created_at ON exchange_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_post_categories_post ON exchange_post_categories(post_id);
CREATE INDEX IF NOT EXISTS idx_exchange_post_categories_category ON exchange_post_categories(category_id);
CREATE INDEX IF NOT EXISTS idx_exchange_post_tags_post ON exchange_post_tags(post_id);
CREATE INDEX IF NOT EXISTS idx_exchange_post_tags_tag ON exchange_post_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_exchange_downloads_post ON exchange_downloads(post_id);
CREATE INDEX IF NOT EXISTS idx_exchange_downloads_user ON exchange_downloads(user_id);
CREATE INDEX IF NOT EXISTS idx_exchange_sandbox_user ON exchange_sandbox_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_exchange_sandbox_expires ON exchange_sandbox_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_exchange_bot_queries_user ON exchange_bot_queries(source_user_id);
CREATE INDEX IF NOT EXISTS idx_exchange_bot_queries_post ON exchange_bot_queries(target_post_id);
CREATE INDEX IF NOT EXISTS idx_exchange_tags_name ON exchange_tags(name);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE exchange_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_post_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_downloads ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_sandbox_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_bot_queries ENABLE ROW LEVEL SECURITY;

-- Posts: Anyone can read published, owners can manage
CREATE POLICY "Anyone can view published posts"
  ON exchange_posts FOR SELECT USING (is_published = true);

CREATE POLICY "Owners can view own posts"
  ON exchange_posts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create posts"
  ON exchange_posts FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owners can update own posts"
  ON exchange_posts FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Owners can delete own posts"
  ON exchange_posts FOR DELETE USING (auth.uid() = user_id);

-- Categories: Public read
CREATE POLICY "Anyone can view categories"
  ON exchange_categories FOR SELECT USING (true);

-- Post categories: Public read for published, owner manage
CREATE POLICY "Anyone can view post categories"
  ON exchange_post_categories FOR SELECT USING (true);

CREATE POLICY "Post owners can insert categories"
  ON exchange_post_categories FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM exchange_posts WHERE id = post_id AND user_id = auth.uid())
  );

CREATE POLICY "Post owners can delete categories"
  ON exchange_post_categories FOR DELETE USING (
    EXISTS (SELECT 1 FROM exchange_posts WHERE id = post_id AND user_id = auth.uid())
  );

-- Tags: Public read, users can insert
CREATE POLICY "Anyone can view tags"
  ON exchange_tags FOR SELECT USING (true);

CREATE POLICY "Users can create tags"
  ON exchange_tags FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Post tags: Public read, owner manage
CREATE POLICY "Anyone can view post tags"
  ON exchange_post_tags FOR SELECT USING (true);

CREATE POLICY "Post owners can insert tags"
  ON exchange_post_tags FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM exchange_posts WHERE id = post_id AND user_id = auth.uid())
  );

CREATE POLICY "Post owners can delete tags"
  ON exchange_post_tags FOR DELETE USING (
    EXISTS (SELECT 1 FROM exchange_posts WHERE id = post_id AND user_id = auth.uid())
  );

-- Downloads: User can see own, insert own
CREATE POLICY "Users can view own downloads"
  ON exchange_downloads FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create downloads"
  ON exchange_downloads FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Sandbox: Users manage own
CREATE POLICY "Users can view own sandbox sessions"
  ON exchange_sandbox_sessions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create sandbox sessions"
  ON exchange_sandbox_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sandbox sessions"
  ON exchange_sandbox_sessions FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sandbox sessions"
  ON exchange_sandbox_sessions FOR DELETE USING (auth.uid() = user_id);

-- Bot queries: Users manage own
CREATE POLICY "Users can view own bot queries"
  ON exchange_bot_queries FOR SELECT USING (auth.uid() = source_user_id);

CREATE POLICY "Users can create bot queries"
  ON exchange_bot_queries FOR INSERT WITH CHECK (auth.uid() = source_user_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to increment download count
CREATE OR REPLACE FUNCTION increment_download_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE exchange_posts
  SET download_count = download_count + 1
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for download count
DROP TRIGGER IF EXISTS trigger_increment_download_count ON exchange_downloads;
CREATE TRIGGER trigger_increment_download_count
  AFTER INSERT ON exchange_downloads
  FOR EACH ROW
  EXECUTE FUNCTION increment_download_count();

-- Function to increment test count when sandbox session created
CREATE OR REPLACE FUNCTION increment_test_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE exchange_posts
  SET test_count = test_count + 1
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for test count
DROP TRIGGER IF EXISTS trigger_increment_test_count ON exchange_sandbox_sessions;
CREATE TRIGGER trigger_increment_test_count
  AFTER INSERT ON exchange_sandbox_sessions
  FOR EACH ROW
  EXECUTE FUNCTION increment_test_count();

-- Function to update tag use count
CREATE OR REPLACE FUNCTION update_tag_use_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE exchange_tags SET use_count = use_count + 1 WHERE id = NEW.tag_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE exchange_tags SET use_count = GREATEST(use_count - 1, 0) WHERE id = OLD.tag_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for tag use count
DROP TRIGGER IF EXISTS trigger_update_tag_use_count ON exchange_post_tags;
CREATE TRIGGER trigger_update_tag_use_count
  AFTER INSERT OR DELETE ON exchange_post_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_tag_use_count();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_exchange_post_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_exchange_post_updated_at ON exchange_posts;
CREATE TRIGGER trigger_update_exchange_post_updated_at
  BEFORE UPDATE ON exchange_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_exchange_post_updated_at();

-- Function to clean up expired sandbox sessions (can be called by cron job)
CREATE OR REPLACE FUNCTION cleanup_expired_sandbox_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM exchange_sandbox_sessions WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function to increment post test count (for individual chat queries)
CREATE OR REPLACE FUNCTION increment_post_test_count(post_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE exchange_posts
  SET test_count = test_count + 1
  WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
