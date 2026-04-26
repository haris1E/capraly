/**
 * Composer panel — accepts a high-level instruction and generates a
 * multi-file change plan. Each proposed change shows a diff and can be
 * applied (or skipped) individually. Apply uses the same bus events the
 * sidebar/editor already listen for, so changes survive the next reload.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Loader2, Wand2, ChevronDown, ChevronRight, FilePlus2, FileEdit, Check } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import DiffViewer from "@/components/editor/DiffViewer";
import { detectLanguage } from "@/lib/languages";
import { aiThrottle } from "@/lib/aiThrottle";
import { aiErrors } from "@/lib/aiErrorStore";

interface Change {
  op: "create" | "replace";
  name: string;
  language?: string;
  content: string;
  rationale: string;
}
interface Plan { summary: string; changes: Change[] }

interface Props {
  projectId: string | null;
  ownerId: string;
}

export default function Composer({ projectId, ownerId }: Props) {
  const qc = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [applied, setApplied] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState(false);

  const { data: existingFiles = [] } = useQuery({
    queryKey: ["composer-files", projectId],
    enabled: !!projectId,
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("files")
        .select("id, name, language, content")
        .eq("project_id", projectId);
      if (error) throw error;
      return data;
    },
  });

  const generate = async () => {
    if (!projectId) return toast.error("Open a project first");
    if (!prompt.trim()) return;

    const guard = aiThrottle.check("ai-composer");
    if (!guard.ok) {
      const sec = Math.ceil((guard as { retryAfterMs: number }).retryAfterMs / 1000);
      return toast.warning(`Slow down — wait ${sec}s`);
    }

    setLoading(true);
    setPlan(null);
    setApplied({});
    aiThrottle.markStart("ai-composer");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return toast.error("Session expired — sign in again"); }

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-composer`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            instruction: prompt,
            files: (existingFiles || []).map((f) => ({
              name: f.name,
              language: f.language,
              content: f.content,
            })),
          }),
        },
      );

      if (!resp.ok) {
        let body = "";
        try { body = await resp.text(); } catch { /* noop */ }
        let msg = `Composer failed (${resp.status})`;
        try { msg = JSON.parse(body)?.error ?? msg; } catch { /* noop */ }
        aiErrors.push({
          status: resp.status,
          message: msg,
          endpoint: "ai-composer",
          requestSummary: `POST /ai-composer\nfiles: ${existingFiles.length}`,
          rawBody: body,
        });
        aiThrottle.markFailure("ai-composer", resp.status);
        toast.error(msg);
        return;
      }

      const data = await resp.json();
      setPlan(data.plan as Plan);
      aiThrottle.markSuccess("ai-composer");
    } finally {
      setLoading(false);
    }
  };

  const applyChange = useMutation({
    mutationFn: async ({ change }: { idx: number; change: Change }) => {
      if (!projectId) throw new Error("No project");
      const existing = existingFiles.find((f) => f.name === change.name);
      const lang = change.language || detectLanguage(change.name);

      if (existing) {
        const { error } = await supabase
          .from("files")
          .update({ content: change.content, language: lang })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("files").insert({
          project_id: projectId,
          owner_id: ownerId,
          name: change.name,
          language: lang,
          content: change.content,
        });
        if (error) throw error;
      }
    },
    onSuccess: (_d, { idx }) => {
      setApplied((s) => ({ ...s, [idx]: true }));
      qc.invalidateQueries({ queryKey: ["files"] });
      qc.invalidateQueries({ queryKey: ["composer-files", projectId] });
      toast.success("Change applied");
    },
    onError: (e: any) => toast.error(e.message ?? "Apply failed"),
  });

  const applyAll = async () => {
    if (!plan) return;
    for (let i = 0; i < plan.changes.length; i++) {
      if (applied[i]) continue;
      await applyChange.mutateAsync({ idx: i, change: plan.changes[i] });
    }
  };

  return (
    <div className="flex h-full flex-col bg-surface-1">
      <div className="flex h-12 items-center gap-2 border-b border-border px-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-primary shadow-glow">
          <Wand2 className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider">Composer</span>
        <span className="ml-auto font-mono text-[10px] text-muted-foreground">
          {projectId ? `${existingFiles.length} files in scope` : "no project"}
        </span>
      </div>

      <div className="border-b border-border p-3">
        <Textarea
          placeholder='e.g. "add a Fibonacci utility module and a test file that uses it"'
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); generate(); }
          }}
          className="resize-none bg-surface-2 text-xs"
          disabled={loading}
        />
        <Button
          variant="hero"
          size="sm"
          className="mt-2 w-full"
          disabled={loading || !prompt.trim() || !projectId}
          onClick={generate}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {loading ? "Planning…" : "Generate plan"}
        </Button>
        <p className="mt-1.5 text-center font-mono text-[10px] text-muted-foreground">⌘↵ to run</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!plan && !loading && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Wand2 className="h-7 w-7 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">Describe a change</p>
            <p className="mt-1 max-w-[260px] text-xs text-muted-foreground">
              Composer plans multi-file edits. You'll preview each diff before any file is touched.
            </p>
          </div>
        )}

        {plan && (
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-surface-2 p-3 text-xs">
              <p className="mb-1 font-semibold uppercase tracking-wider text-[10px] text-muted-foreground">Plan summary</p>
              <p>{plan.summary}</p>
            </div>

            <div className="flex justify-end">
              <Button variant="ai" size="sm" onClick={applyAll} disabled={applyChange.isPending}>
                <Check className="h-3.5 w-3.5" /> Apply all
              </Button>
            </div>

            {plan.changes.map((c, idx) => {
              const isOpen = open[idx];
              const before = existingFiles.find((f) => f.name === c.name)?.content ?? "";
              const isApplied = applied[idx];
              return (
                <div key={idx} className="rounded-md border border-border bg-surface-2">
                  <button
                    className="flex w-full items-center gap-2 px-3 py-2 text-left"
                    onClick={() => setOpen((s) => ({ ...s, [idx]: !isOpen }))}
                  >
                    {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                    {c.op === "create" ? <FilePlus2 className="h-3.5 w-3.5 text-success" /> : <FileEdit className="h-3.5 w-3.5 text-primary" />}
                    <span className="flex-1 truncate font-mono text-xs">{c.name}</span>
                    <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">{c.op}</span>
                    {isApplied && <Check className="h-3.5 w-3.5 text-success" />}
                  </button>
                  {isOpen && (
                    <div className="space-y-2 border-t border-border p-3">
                      <p className="text-xs text-muted-foreground">{c.rationale}</p>
                      <DiffViewer before={before} after={c.content} />
                      <div className="flex justify-end">
                        <Button
                          variant="hero"
                          size="sm"
                          className="h-7 text-[11px]"
                          disabled={isApplied || applyChange.isPending}
                          onClick={() => applyChange.mutate({ idx, change: c })}
                        >
                          {applyChange.isPending && applyChange.variables?.idx === idx
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Check className="h-3 w-3" />}
                          {isApplied ? "Applied" : c.op === "create" ? "Create file" : "Replace file"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
