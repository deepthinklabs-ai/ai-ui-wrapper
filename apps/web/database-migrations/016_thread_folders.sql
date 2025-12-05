-- Migration: Thread Folders
-- Adds folder organization for threads with unlimited nesting support

-- 1. Create folders table
CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT NULL, -- Optional color for folder icon
  icon TEXT DEFAULT NULL,  -- Optional icon name
  position INTEGER DEFAULT 0, -- For custom ordering within parent
  is_collapsed BOOLEAN DEFAULT false, -- Remember collapsed state
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Add folder_id to threads table
ALTER TABLE public.threads
ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL;

-- 3. Add position column to threads for ordering within folders
ALTER TABLE public.threads
ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- 4. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_folders_user_id ON public.folders(user_id);
CREATE INDEX IF NOT EXISTS idx_folders_parent_id ON public.folders(parent_id);
CREATE INDEX IF NOT EXISTS idx_threads_folder_id ON public.threads(folder_id);

-- 5. Enable Row Level Security
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for folders
-- Users can only see their own folders
CREATE POLICY "Users can view own folders"
  ON public.folders FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create folders for themselves
CREATE POLICY "Users can create own folders"
  ON public.folders FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own folders
CREATE POLICY "Users can update own folders"
  ON public.folders FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own folders
CREATE POLICY "Users can delete own folders"
  ON public.folders FOR DELETE
  USING (auth.uid() = user_id);

-- 7. Create trigger for updated_at
CREATE OR REPLACE FUNCTION update_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW
  EXECUTE FUNCTION update_folders_updated_at();

-- 8. Helper function to get folder path (for breadcrumbs)
CREATE OR REPLACE FUNCTION get_folder_path(folder_uuid UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  depth INTEGER
) AS $$
WITH RECURSIVE folder_path AS (
  -- Base case: start with the given folder
  SELECT f.id, f.name, f.parent_id, 0 as depth
  FROM public.folders f
  WHERE f.id = folder_uuid

  UNION ALL

  -- Recursive case: get parent folders
  SELECT f.id, f.name, f.parent_id, fp.depth + 1
  FROM public.folders f
  JOIN folder_path fp ON f.id = fp.parent_id
)
SELECT fp.id, fp.name, fp.depth
FROM folder_path fp
ORDER BY fp.depth DESC;
$$ LANGUAGE sql STABLE;

-- 9. Helper function to get all descendant folder IDs (for cascade operations)
CREATE OR REPLACE FUNCTION get_folder_descendants(folder_uuid UUID)
RETURNS TABLE (id UUID) AS $$
WITH RECURSIVE descendants AS (
  -- Base case: direct children
  SELECT f.id
  FROM public.folders f
  WHERE f.parent_id = folder_uuid

  UNION ALL

  -- Recursive case: children of children
  SELECT f.id
  FROM public.folders f
  JOIN descendants d ON f.parent_id = d.id
)
SELECT * FROM descendants;
$$ LANGUAGE sql STABLE;

-- 10. Prevent circular references in folder hierarchy
CREATE OR REPLACE FUNCTION check_folder_hierarchy()
RETURNS TRIGGER AS $$
DECLARE
  ancestor_id UUID;
BEGIN
  -- If parent_id is null, no check needed
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if new parent_id would create a cycle
  -- by checking if it's a descendant of the current folder
  IF EXISTS (
    SELECT 1 FROM get_folder_descendants(NEW.id) d
    WHERE d.id = NEW.parent_id
  ) THEN
    RAISE EXCEPTION 'Cannot set parent: would create circular reference';
  END IF;

  -- Also check if parent is the folder itself
  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'A folder cannot be its own parent';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_folder_cycle
  BEFORE UPDATE ON public.folders
  FOR EACH ROW
  WHEN (NEW.parent_id IS DISTINCT FROM OLD.parent_id)
  EXECUTE FUNCTION check_folder_hierarchy();
