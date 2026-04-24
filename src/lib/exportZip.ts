/**
 * One-click project export — bundles all files in a project into a ZIP
 * along with a manifest.json describing language + last-saved metadata.
 */
import JSZip from "jszip";
import { supabase } from "@/integrations/supabase/client";

export interface ExportManifestEntry {
  path: string;
  language: string;
  size: number;
  updatedAt: string;
}

export interface ExportManifest {
  project: { id: string; name: string; description: string | null };
  exportedAt: string;
  files: ExportManifestEntry[];
}

export async function exportProjectAsZip(projectId: string, projectName: string, projectDescription: string | null) {
  const { data: files, error } = await supabase
    .from("files")
    .select("name, content, language, updated_at")
    .eq("project_id", projectId)
    .order("name");
  if (error) throw error;

  const zip = new JSZip();
  const folder = zip.folder(safeName(projectName)) ?? zip;

  const manifest: ExportManifest = {
    project: { id: projectId, name: projectName, description: projectDescription },
    exportedAt: new Date().toISOString(),
    files: [],
  };

  for (const f of files ?? []) {
    const content = (f as any).content ?? "";
    const path = (f as any).name;
    folder.file(path, content);
    manifest.files.push({
      path,
      language: (f as any).language,
      size: new Blob([content]).size,
      updatedAt: (f as any).updated_at,
    });
  }

  folder.file("manifest.json", JSON.stringify(manifest, null, 2));

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safeName(projectName)}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function safeName(s: string) {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "project";
}
