import { supabase } from "@/integrations/supabase/client";

/**
 * Logs a blocked cross-user / RLS-denied attempt to the audit_log table.
 * Safe to call from anywhere — failures are swallowed so logging never
 * breaks user flows.
 *
 * @param resourceType e.g. "ai_threads" | "storage.project-files"
 * @param action       e.g. "select" | "update" | "delete" | "download"
 * @param resourceId   the row id / object name attempted
 * @param details      arbitrary context (error message, path, etc.)
 */
export async function logBlockedAttempt(
  resourceType: string,
  action: string,
  resourceId?: string | null,
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    await supabase.rpc("log_blocked_attempt", {
      _resource_type: resourceType,
      _action: action,
      _resource_id: resourceId ?? "",
      _details: details as never,
    });
  } catch (err) {
    // never throw from audit logging
    if (typeof console !== "undefined") {
      console.warn("[audit] failed to log blocked attempt", err);
    }
  }
}

/**
 * Heuristic: classify a Supabase error as an RLS / permission denial.
 */
export function isRlsDenialError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string; status?: number };
  if (e.code === "42501" || e.code === "PGRST301" || e.code === "PGRST116") return true;
  if (e.status === 401 || e.status === 403) return true;
  const msg = (e.message ?? "").toLowerCase();
  return (
    msg.includes("row-level security") ||
    msg.includes("rls") ||
    msg.includes("permission denied") ||
    msg.includes("not authorized")
  );
}

/**
 * Wrap a Supabase call: if it returns an RLS-style error, log it as blocked.
 * Returns the original result unchanged.
 */
export async function auditIfBlocked<T extends { error: unknown }>(
  promise: Promise<T>,
  resourceType: string,
  action: string,
  resourceId?: string | null,
  extra: Record<string, unknown> = {}
): Promise<T> {
  const result = await promise;
  if (result.error && isRlsDenialError(result.error)) {
    const err = result.error as { message?: string; code?: string };
    await logBlockedAttempt(resourceType, action, resourceId, {
      ...extra,
      error_message: err.message,
      error_code: err.code,
    });
  }
  return result;
}
