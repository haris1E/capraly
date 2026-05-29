## Plan: Resolve 4 security findings

### 1. Tighten `ai_threads` RLS (project ownership)
Migration: drop and recreate INSERT + UPDATE policies on `public.ai_threads` to also require the referenced `project_id` to be owned by `auth.uid()`:
```sql
WITH CHECK (
  auth.uid() = owner_id
  AND EXISTS (SELECT 1 FROM public.projects p
              WHERE p.id = project_id AND p.owner_id = auth.uid())
)
```
Same EXISTS guard on UPDATE (USING + WITH CHECK).

### 2. Isolate `run-code` subprocess env
Edit `supabase/functions/run-code/index.ts` — add `clearEnv: true` to the `Deno.Command` options so the spawned Deno child can't inherit `LOVABLE_API_KEY`, service role key, etc.

### 3 & 4. Lock down SECURITY DEFINER functions
The public-schema SECURITY DEFINER functions (`handle_new_user`, `_audit_write`, `_audit_ai_threads`, `_audit_project_files`, `log_blocked_attempt`) are internal — only triggers and other server code should call them; nothing in the client invokes them via PostgREST. Migration will:
```sql
REVOKE EXECUTE ON FUNCTION public._audit_write(...)         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._audit_ai_threads()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._audit_project_files()    FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_blocked_attempt(...)  FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user()         FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at()          FROM PUBLIC, anon, authenticated;
-- keep GRANT EXECUTE ... TO service_role for server-side use
```
Triggers continue to work (trigger execution doesn't check EXECUTE on the function). `log_blocked_attempt` is currently called from client code via `auditLog.ts`; I'll switch that call to invoke it through an authenticated edge function path, or keep `authenticated` EXECUTE for that one function only and revoke just `anon`. I'll verify `src/lib/auditLog.ts` usage first and pick the minimal-impact option.

### 5. Mark findings resolved
After migration + edge function deploy, call `security--manage_security_finding` (mark_as_fixed) for all 4 internal_ids and update security memory.

### Files
- new migration under `supabase/migrations/`
- `supabase/functions/run-code/index.ts` (one-line change)
- possibly `src/lib/auditLog.ts` (if we route through an edge function)
