-- Migration: Default Folder Support
-- Adds is_default column to folders and ensures each user has a default folder

-- 1. Add is_default column to folders table
ALTER TABLE public.folders
ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false;

-- 2. Create index for quickly finding default folder
CREATE INDEX IF NOT EXISTS idx_folders_is_default ON public.folders(user_id, is_default) WHERE is_default = true;

-- 3. Ensure only one default folder per user (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_folders_unique_default
ON public.folders(user_id)
WHERE is_default = true;

-- 4. Prevent deletion of default folders
CREATE OR REPLACE FUNCTION prevent_default_folder_deletion()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_default = true THEN
    RAISE EXCEPTION 'Cannot delete the default folder. Move threads to another folder first.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_default_folder_delete ON public.folders;
CREATE TRIGGER prevent_default_folder_delete
  BEFORE DELETE ON public.folders
  FOR EACH ROW
  EXECUTE FUNCTION prevent_default_folder_deletion();

-- 5. Prevent changing is_default from true to false if it's the only default
CREATE OR REPLACE FUNCTION prevent_default_folder_unset()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.is_default = true AND NEW.is_default = false THEN
    RAISE EXCEPTION 'Cannot unset the default folder. Create another default folder first.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_default_folder_unset ON public.folders;
CREATE TRIGGER prevent_default_folder_unset
  BEFORE UPDATE ON public.folders
  FOR EACH ROW
  WHEN (OLD.is_default = true AND NEW.is_default = false)
  EXECUTE FUNCTION prevent_default_folder_unset();

-- 6. Function to get or create default folder for a user
CREATE OR REPLACE FUNCTION get_or_create_default_folder(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_folder_id UUID;
BEGIN
  -- Try to find existing default folder
  SELECT id INTO v_folder_id
  FROM public.folders
  WHERE user_id = p_user_id AND is_default = true
  LIMIT 1;

  -- If not found, create one
  IF v_folder_id IS NULL THEN
    INSERT INTO public.folders (user_id, name, is_default, position)
    VALUES (p_user_id, 'General', true, 0)
    RETURNING id INTO v_folder_id;
  END IF;

  RETURN v_folder_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Migrate existing threads without folders to default folder
-- This creates default folders for users who have threads without folder_id
-- and moves those threads into the default folder
DO $$
DECLARE
  r RECORD;
  default_folder_id UUID;
BEGIN
  -- Find all users with threads that have no folder
  FOR r IN
    SELECT DISTINCT user_id
    FROM public.threads
    WHERE folder_id IS NULL
  LOOP
    -- Get or create default folder for this user
    default_folder_id := get_or_create_default_folder(r.user_id);

    -- Move all their folderless threads to the default folder
    UPDATE public.threads
    SET folder_id = default_folder_id
    WHERE user_id = r.user_id AND folder_id IS NULL;
  END LOOP;
END $$;
