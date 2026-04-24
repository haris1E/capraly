import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight, ChevronDown, FileCode2, FilePlus, FolderPlus,
  Trash2, Loader2, LogOut, Sparkles, Download
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { detectLanguage } from "@/lib/languages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { exportProjectAsZip } from "@/lib/exportZip";
import { editorBus } from "@/lib/editorBus";
import type { User } from "@supabase/supabase-js";

interface Project {
  id: string;
  name: string;
  description: string | null;
}
interface FileRow {
  id: string;
  project_id: string;
  name: string;
  language: string;
}

interface Props {
  user: User;
  activeFileId: string | null;
  onOpenFile: (file: FileRow) => void;
}

export default function ProjectSidebar({ user, activeFileId, onOpenFile }: Props) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [newProjectName, setNewProjectName] = useState("");
  const [creatingProject, setCreatingProject] = useState(false);
  const [newFileFor, setNewFileFor] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, description")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Project[];
    },
  });

  const { data: filesByProject = {} } = useQuery({
    queryKey: ["files", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("files")
        .select("id, project_id, name, language")
        .order("name");
      if (error) throw error;
      const map: Record<string, FileRow[]> = {};
      (data as FileRow[]).forEach((f) => {
        (map[f.project_id] ||= []).push(f);
      });
      return map;
    },
  });

  // Auto-expand projects that have no expanded state yet on first load
  useEffect(() => {
    if (projects.length && Object.keys(expanded).length === 0) {
      const init: Record<string, boolean> = {};
      projects.forEach((p) => { init[p.id] = true; });
      setExpanded(init);
    }
  }, [projects, expanded]);

  // Seed: create a starter project + file the first time the user has none
  const seedMutation = useMutation({
    mutationFn: async () => {
      const { data: project, error } = await supabase
        .from("projects")
        .insert({ owner_id: user.id, name: "My First Project", description: "Welcome to Capraly" })
        .select()
        .single();
      if (error) throw error;
      await supabase.from("files").insert({
        project_id: project.id,
        owner_id: user.id,
        name: "hello.ts",
        language: "typescript",
        content: `// Welcome to Capraly — try the AI Bug Finder on the right!\n\nfunction greet(name: string) {\n  console.log("Hello, " + name);\n}\n\ngreet("world");\n`,
      });
      return project;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", user.id] });
      qc.invalidateQueries({ queryKey: ["files", user.id] });
    },
  });

  useEffect(() => {
    if (!isLoading && projects.length === 0 && !seedMutation.isPending) {
      seedMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, projects.length]);

  const createProject = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("projects")
        .insert({ owner_id: user.id, name })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", user.id] });
      setNewProjectName("");
      setCreatingProject(false);
      toast.success("Project created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createFile = useMutation({
    mutationFn: async ({ projectId, name }: { projectId: string; name: string }) => {
      const { data, error } = await supabase
        .from("files")
        .insert({
          project_id: projectId,
          owner_id: user.id,
          name,
          language: detectLanguage(name),
          content: "",
        })
        .select()
        .single();
      if (error) throw error;
      return data as FileRow;
    },
    onSuccess: (file) => {
      qc.invalidateQueries({ queryKey: ["files", user.id] });
      setNewFileFor(null);
      setNewFileName("");
      onOpenFile(file);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects", user.id] });
      qc.invalidateQueries({ queryKey: ["files", user.id] });
      toast.success("Project deleted");
    },
  });

  const deleteFile = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("files").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["files", user.id] }),
  });

  // Export project as ZIP (with manifest)
  const exportMutation = useMutation({
    mutationFn: async (project: Project) => {
      await exportProjectAsZip(project.id, project.name, project.description);
    },
    onSuccess: () => toast.success("Project exported as ZIP"),
    onError: (e: any) => toast.error(e.message ?? "Export failed"),
  });

  // Wire global shortcut: ⌘N → focus the first project's "new file" input.
  useEffect(() => {
    return editorBus.on((e) => {
      if (e.type === "new-file") {
        const first = projects[0];
        if (!first) return toast.message("Create a project first");
        setExpanded((s) => ({ ...s, [first.id]: true }));
        setNewFileFor(first.id);
      }
    });
  }, [projects]);

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-surface-1">
      {/* Brand */}
      <div className="flex h-12 items-center gap-2 border-b border-border px-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-primary shadow-glow">
          <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="font-display text-sm font-bold tracking-tight">Capraly</span>
        <span className="ml-auto rounded-full bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">v1</span>
      </div>

      {/* New project */}
      <div className="border-b border-border p-2">
        {creatingProject ? (
          <div className="flex gap-1">
            <Input
              autoFocus
              placeholder="Project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newProjectName.trim()) createProject.mutate(newProjectName.trim());
                if (e.key === "Escape") setCreatingProject(false);
              }}
              className="h-7 bg-surface-2 text-xs"
            />
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs"
            onClick={() => setCreatingProject(true)}
          >
            <FolderPlus className="h-3.5 w-3.5" />
            New project
          </Button>
        )}
      </div>

      {/* Projects + files */}
      <div className="flex-1 overflow-y-auto p-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : projects.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            Setting up your workspace…
          </p>
        ) : (
          <ul className="space-y-1">
            {projects.map((p) => {
              const isOpen = expanded[p.id] ?? false;
              const files = filesByProject[p.id] || [];
              return (
                <li key={p.id} className="group">
                  <div className="flex items-center rounded-md hover:bg-surface-2">
                    <button
                      onClick={() => setExpanded((e) => ({ ...e, [p.id]: !isOpen }))}
                      className="flex flex-1 items-center gap-1 px-2 py-1.5 text-xs font-medium"
                    >
                      {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      <span className="truncate">{p.name}</span>
                    </button>
                    <button
                      title="New file"
                      onClick={(e) => {
                        e.stopPropagation();
                        setExpanded((s) => ({ ...s, [p.id]: true }));
                        setNewFileFor(p.id);
                      }}
                      className="invisible mx-0.5 rounded p-1 text-muted-foreground hover:bg-surface-3 hover:text-foreground group-hover:visible"
                    >
                      <FilePlus className="h-3 w-3" />
                    </button>
                    <button
                      title="Export project as ZIP"
                      onClick={(e) => { e.stopPropagation(); exportMutation.mutate(p); }}
                      disabled={exportMutation.isPending}
                      className="invisible mx-0.5 rounded p-1 text-muted-foreground hover:bg-surface-3 hover:text-primary group-hover:visible disabled:opacity-50"
                    >
                      {exportMutation.isPending && exportMutation.variables?.id === p.id
                        ? <Loader2 className="h-3 w-3 animate-spin" />
                        : <Download className="h-3 w-3" />}
                    </button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          title="Delete"
                          className="invisible mr-1 rounded p-1 text-muted-foreground hover:bg-surface-3 hover:text-destructive group-hover:visible"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete project "{p.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            All files inside will be permanently removed. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteProject.mutate(p.id)}>
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  {isOpen && (
                    <ul className="ml-2 mt-0.5 space-y-0.5 border-l border-border pl-2">
                      {files.map((f) => (
                        <li key={f.id} className="group/file flex items-center rounded-md hover:bg-surface-2">
                          <button
                            onClick={() => onOpenFile(f)}
                            className={cn(
                              "flex flex-1 items-center gap-1.5 truncate px-2 py-1 text-xs font-mono",
                              activeFileId === f.id
                                ? "bg-surface-3 text-primary"
                                : "text-foreground/80 hover:text-foreground",
                            )}
                          >
                            <FileCode2 className="h-3 w-3 shrink-0" />
                            <span className="truncate">{f.name}</span>
                          </button>
                          <button
                            onClick={() => deleteFile.mutate(f.id)}
                            className="invisible mr-1 rounded p-0.5 text-muted-foreground hover:text-destructive group-hover/file:visible"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </li>
                      ))}
                      {newFileFor === p.id && (
                        <li>
                          <Input
                            autoFocus
                            placeholder="filename.ts"
                            value={newFileName}
                            onChange={(e) => setNewFileName(e.target.value)}
                            onBlur={() => { if (!newFileName) setNewFileFor(null); }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && newFileName.trim()) {
                                createFile.mutate({ projectId: p.id, name: newFileName.trim() });
                              }
                              if (e.key === "Escape") { setNewFileFor(null); setNewFileName(""); }
                            }}
                            className="ml-1 h-6 bg-surface-2 font-mono text-xs"
                          />
                        </li>
                      )}
                      {files.length === 0 && newFileFor !== p.id && (
                        <li className="px-2 py-1 text-[11px] italic text-muted-foreground">No files yet</li>
                      )}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* User footer */}
      <div className="border-t border-border p-2">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-ai text-[10px] font-bold text-secondary-foreground">
            {user.email?.[0]?.toUpperCase() ?? "?"}
          </div>
          <span className="flex-1 truncate text-xs text-muted-foreground">{user.email}</span>
          <button
            onClick={() => supabase.auth.signOut()}
            title="Sign out"
            className="rounded p-1 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex items-center justify-center gap-2 px-2 pb-1 text-[10px] text-muted-foreground/70">
          <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
          <span>·</span>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
        </div>
      </div>
    </aside>
  );
}
