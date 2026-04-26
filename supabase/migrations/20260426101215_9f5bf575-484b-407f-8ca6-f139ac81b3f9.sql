
-- =========================================================
-- Audit log table
-- =========================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  actor_id      uuid,                        -- auth.uid() at time of action (nullable for anon attempts)
  resource_type text NOT NULL,               -- 'ai_threads' | 'storage.project-files'
  resource_id   text,                        -- thread id / object name
  action        text NOT NULL,               -- 'insert' | 'update' | 'delete' | 'select_blocked' | etc.
  outcome       text NOT NULL DEFAULT 'allowed', -- 'allowed' | 'blocked'
  target_owner  uuid,                        -- owner of the row/object that was acted on (when known)
  details       jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS audit_log_actor_created_idx
  ON public.audit_log (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_resource_idx
  ON public.audit_log (resource_type, resource_id);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;

-- Users can read their own audit entries (entries they were the actor for,
-- or entries that targeted resources they own).
DROP POLICY IF EXISTS "audit_log_select_own" ON public.audit_log;
CREATE POLICY "audit_log_select_own"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = actor_id
    OR auth.uid() = target_owner
  );

-- Append-only: no UPDATE/DELETE policies = denied for all non-superusers.
-- INSERTs only happen via SECURITY DEFINER triggers/RPC; no direct INSERT policy.

-- =========================================================
-- Internal writer (SECURITY DEFINER) — bypasses RLS for inserts
-- =========================================================
CREATE OR REPLACE FUNCTION public._audit_write(
  _actor_id uuid,
  _resource_type text,
  _resource_id text,
  _action text,
  _outcome text,
  _target_owner uuid,
  _details jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (
    actor_id, resource_type, resource_id, action, outcome, target_owner, details
  ) VALUES (
    _actor_id, _resource_type, _resource_id, _action, _outcome, _target_owner, COALESCE(_details, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public._audit_write(uuid, text, text, text, text, uuid, jsonb) FROM public, anon, authenticated;

-- =========================================================
-- Public RPC: log a blocked attempt from the client
-- =========================================================
CREATE OR REPLACE FUNCTION public.log_blocked_attempt(
  _resource_type text,
  _resource_id text,
  _action text,
  _details jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _resource_type IS NULL OR length(_resource_type) = 0 OR length(_resource_type) > 100 THEN
    RAISE EXCEPTION 'invalid resource_type';
  END IF;
  IF _action IS NULL OR length(_action) = 0 OR length(_action) > 50 THEN
    RAISE EXCEPTION 'invalid action';
  END IF;

  PERFORM public._audit_write(
    auth.uid(),
    _resource_type,
    left(COALESCE(_resource_id, ''), 500),
    _action,
    'blocked',
    NULL,
    COALESCE(_details, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_blocked_attempt(text, text, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.log_blocked_attempt(text, text, text, jsonb) TO authenticated;

-- =========================================================
-- Trigger: ai_threads -> audit_log
-- =========================================================
CREATE OR REPLACE FUNCTION public._audit_ai_threads()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action text;
  v_target uuid;
  v_id     uuid;
  v_details jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'insert';
    v_target := NEW.owner_id;
    v_id := NEW.id;
    v_details := jsonb_build_object('title', NEW.title, 'kind', NEW.kind, 'project_id', NEW.project_id);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_target := NEW.owner_id;
    v_id := NEW.id;
    v_details := jsonb_build_object(
      'owner_changed', (OLD.owner_id IS DISTINCT FROM NEW.owner_id),
      'title_changed', (OLD.title IS DISTINCT FROM NEW.title)
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_target := OLD.owner_id;
    v_id := OLD.id;
    v_details := jsonb_build_object('title', OLD.title);
  END IF;

  PERFORM public._audit_write(
    auth.uid(),
    'ai_threads',
    v_id::text,
    v_action,
    'allowed',
    v_target,
    v_details
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_ai_threads_trg ON public.ai_threads;
CREATE TRIGGER audit_ai_threads_trg
AFTER INSERT OR UPDATE OR DELETE ON public.ai_threads
FOR EACH ROW EXECUTE FUNCTION public._audit_ai_threads();

-- =========================================================
-- Trigger: storage.objects (project-files only) -> audit_log
-- =========================================================
CREATE OR REPLACE FUNCTION public._audit_project_files()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_action text;
  v_target uuid;
  v_name   text;
  v_details jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.bucket_id <> 'project-files' THEN RETURN NEW; END IF;
    v_action := 'insert';
    v_target := NEW.owner;
    v_name   := NEW.name;
    v_details := jsonb_build_object('bucket', NEW.bucket_id, 'size', NEW.metadata->>'size');
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.bucket_id <> 'project-files' THEN RETURN NEW; END IF;
    v_action := 'update';
    v_target := NEW.owner;
    v_name   := NEW.name;
    v_details := jsonb_build_object(
      'bucket', NEW.bucket_id,
      'name_changed', (OLD.name IS DISTINCT FROM NEW.name),
      'old_name', OLD.name
    );
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.bucket_id <> 'project-files' THEN RETURN OLD; END IF;
    v_action := 'delete';
    v_target := OLD.owner;
    v_name   := OLD.name;
    v_details := jsonb_build_object('bucket', OLD.bucket_id);
  END IF;

  PERFORM public._audit_write(
    auth.uid(),
    'storage.project-files',
    v_name,
    v_action,
    'allowed',
    v_target,
    v_details
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_project_files_trg ON storage.objects;
CREATE TRIGGER audit_project_files_trg
AFTER INSERT OR UPDATE OR DELETE ON storage.objects
FOR EACH ROW EXECUTE FUNCTION public._audit_project_files();
