
-- =========================================================
-- Harden RLS for ai_threads
-- =========================================================

-- Ensure RLS is enabled and forced
ALTER TABLE public.ai_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_threads FORCE ROW LEVEL SECURITY;

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Owners can view their threads" ON public.ai_threads;
DROP POLICY IF EXISTS "Owners can insert their threads" ON public.ai_threads;
DROP POLICY IF EXISTS "Owners can update their threads" ON public.ai_threads;
DROP POLICY IF EXISTS "Owners can delete their threads" ON public.ai_threads;

-- Recreate scoped to authenticated role only, with WITH CHECK on UPDATE
-- to prevent owner_id reassignment to another user.
CREATE POLICY "ai_threads_select_own"
  ON public.ai_threads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "ai_threads_insert_own"
  ON public.ai_threads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "ai_threads_update_own"
  ON public.ai_threads
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "ai_threads_delete_own"
  ON public.ai_threads
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- =========================================================
-- Harden RLS for storage bucket: project-files
-- Path convention: <auth.uid()>/<project_id>/<filename>
-- =========================================================

-- Drop existing project-files policies
DROP POLICY IF EXISTS "Users can read their own project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to their own project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own project files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own project files" ON storage.objects;

-- Recreate scoped to authenticated role with strict folder match.
-- The first path segment MUST equal auth.uid(); enforced on USING and WITH CHECK
-- to prevent moves/renames into another user's folder.

CREATE POLICY "project_files_select_own"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'project-files'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND owner = auth.uid()
  );

CREATE POLICY "project_files_insert_own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-files'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND owner = auth.uid()
  );

CREATE POLICY "project_files_update_own"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'project-files'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND owner = auth.uid()
  )
  WITH CHECK (
    bucket_id = 'project-files'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND owner = auth.uid()
  );

CREATE POLICY "project_files_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-files'
    AND auth.uid() IS NOT NULL
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND owner = auth.uid()
  );
