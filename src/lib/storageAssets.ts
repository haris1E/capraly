/**
 * Helpers for the `project-files` Storage bucket — used for binary assets
 * (images, fonts, etc.) that don't make sense to keep as DB rows.
 *
 * Path convention: `<user_uid>/<project_id>/<filename>` so RLS policies
 * tied to `(storage.foldername(name))[1] = auth.uid()::text` apply cleanly.
 */
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "project-files";

export async function uploadAsset(
  userId: string,
  projectId: string,
  file: File,
): Promise<{ path: string; publicSignedUrl: string | null }> {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${userId}/${projectId}/${Date.now()}_${safeName}`;

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (upErr) throw upErr;

  // Track in `assets` table
  const { error: rowErr } = await supabase.from("assets").insert({
    project_id: projectId,
    owner_id: userId,
    name: file.name,
    storage_path: path,
    mime_type: file.type || null,
    size_bytes: file.size,
  });
  if (rowErr) throw rowErr;

  // Bucket is private — generate a 1h signed URL
  const { data: signed } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, 3600);

  return { path, publicSignedUrl: signed?.signedUrl ?? null };
}

export async function listAssets(projectId: string) {
  const { data, error } = await supabase
    .from("assets")
    .select("id, name, storage_path, mime_type, size_bytes, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function deleteAsset(id: string, storagePath: string) {
  await supabase.storage.from(BUCKET).remove([storagePath]);
  await supabase.from("assets").delete().eq("id", id);
}
