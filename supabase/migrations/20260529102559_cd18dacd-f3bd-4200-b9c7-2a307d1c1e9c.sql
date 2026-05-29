-- 1. Tighten ai_threads RLS to verify project ownership on INSERT and UPDATE
DROP POLICY IF EXISTS ai_threads_insert_own ON public.ai_threads;
CREATE POLICY ai_threads_insert_own
  ON public.ai_threads FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ai_threads_update_own ON public.ai_threads;
CREATE POLICY ai_threads_update_own
  ON public.ai_threads FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (
    auth.uid() = owner_id
    AND EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id AND p.owner_id = auth.uid()
    )
  );

-- 2. Revoke EXECUTE on internal SECURITY DEFINER (and trigger) functions
-- Triggers still fire regardless of EXECUTE grants.
REVOKE EXECUTE ON FUNCTION public._audit_write(uuid, text, text, text, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._audit_ai_threads() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._audit_project_files() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- log_blocked_attempt is called from the client by signed-in users; allow only authenticated.
REVOKE EXECUTE ON FUNCTION public.log_blocked_attempt(text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_blocked_attempt(text, text, text, jsonb) TO authenticated;