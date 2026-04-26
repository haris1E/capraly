-- ai_threads: persist Composer + Chat conversations per project
CREATE TABLE public.ai_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'New thread',
  kind TEXT NOT NULL DEFAULT 'chat', -- 'chat' | 'composer' | 'inline'
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_threads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their threads"
ON public.ai_threads FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Owners can insert their threads"
ON public.ai_threads FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their threads"
ON public.ai_threads FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their threads"
ON public.ai_threads FOR DELETE
USING (auth.uid() = owner_id);

CREATE TRIGGER ai_threads_set_updated_at
BEFORE UPDATE ON public.ai_threads
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_ai_threads_project ON public.ai_threads(project_id, updated_at DESC);

-- assets: hybrid metadata for binary blobs stored in the project-files bucket
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view their assets"
ON public.assets FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Owners can insert their assets"
ON public.assets FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their assets"
ON public.assets FOR DELETE
USING (auth.uid() = owner_id);

CREATE INDEX idx_assets_project ON public.assets(project_id);

-- Storage bucket: project-files (private; RLS scoped to owner via folder = user uuid)
INSERT INTO storage.buckets (id, name, public) VALUES ('project-files', 'project-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can read their own project files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'project-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload to their own project files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'project-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own project files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'project-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own project files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'project-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);