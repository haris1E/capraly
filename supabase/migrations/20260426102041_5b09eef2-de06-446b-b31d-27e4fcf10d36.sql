-- Explicitly deny INSERT/UPDATE/DELETE on audit_log for any role via restrictive policies.
-- The _audit_write function is SECURITY DEFINER and bypasses RLS, so legitimate
-- audit writes continue to work. Authenticated users cannot tamper with the log.

-- Drop any prior versions if they exist (idempotent)
DROP POLICY IF EXISTS "audit_log_no_insert" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_no_update" ON public.audit_log;
DROP POLICY IF EXISTS "audit_log_no_delete" ON public.audit_log;

-- Restrictive policies that always evaluate false → block writes for everyone
CREATE POLICY "audit_log_no_insert"
ON public.audit_log
AS RESTRICTIVE
FOR INSERT
TO public
WITH CHECK (false);

CREATE POLICY "audit_log_no_update"
ON public.audit_log
AS RESTRICTIVE
FOR UPDATE
TO public
USING (false)
WITH CHECK (false);

CREATE POLICY "audit_log_no_delete"
ON public.audit_log
AS RESTRICTIVE
FOR DELETE
TO public
USING (false);

-- Force RLS so even table owner roles must obey (does not affect SECURITY DEFINER bypass)
ALTER TABLE public.audit_log FORCE ROW LEVEL SECURITY;