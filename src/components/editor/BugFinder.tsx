import { useEffect, useMemo, useRef, useState } from "react";
import { Bug, Loader2, Sparkles, AlertTriangle, GitCompare, Wand2, ChevronDown, ChevronRight } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { streamCompletion } from "@/lib/streamCompletion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Markdown } from "@/components/Markdown";
import DiffViewer from "@/components/editor/DiffViewer";
import { parseFixSnippets } from "@/lib/parseFixSnippets";
import { editorBus } from "@/lib/editorBus";
import { aiErrors } from "@/lib/aiErrorStore";
import type { OpenFile } from "@/components/editor/CodeEditor";

const MODELS = [
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash · fast" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash · balanced" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro · deep" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini · cheap" },
  { value: "openai/gpt-5", label: "GPT-5 · strongest" },
];

interface Props {
  file: OpenFile | null;
}

export default function BugFinder({ file }: Props) {
  const [model, setModel] = useState(MODELS[0].value);
  const [report, setReport] = useState("");
  const [running, setRunning] = useState(false);
  const [openFix, setOpenFix] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fixes = useMemo(() => parseFixSnippets(report), [report]);

  const runScan = async () => {
    if (!file) return toast.error("Open a file first");
    if (!file.content.trim()) return toast.error("File is empty");

    setRunning(true);
    setReport("");
    setOpenFix(null);
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bug-finder`;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setRunning(false);
      return toast.error("Sign in again — your session expired.");
    }

    const requestSummary = `POST /functions/v1/bug-finder
file: ${file.name}
language: ${file.language}
size: ${file.content.length} chars
model: ${model}`;

    try {
      await streamCompletion({
        url,
        signal: controller.signal,
        authToken: session.access_token,
        body: {
          code: file.content,
          language: file.language,
          filename: file.name,
          model,
        },
        onDelta: (chunk) => setReport((r) => r + chunk),
        onError: ({ status, message, rawBody }) => {
          aiErrors.push({
            status,
            message,
            endpoint: "bug-finder",
            requestSummary,
            rawBody,
          });
        },
      });
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error(e);
    } finally {
      setRunning(false);
    }
  };

  // External shortcut handler (Cmd/Ctrl+Shift+B)
  useEffect(() => {
    return editorBus.on((e) => {
      if (e.type === "run-bug-scan") runScan();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id, file?.content, model]);

  return (
    <div className="flex h-full flex-col bg-surface-1">
      <div className="flex h-12 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-ai shadow-ai">
            <Bug className="h-3.5 w-3.5 text-secondary-foreground" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider">AI Bug Finder</span>
        </div>
        <Select value={model} onValueChange={setModel}>
          <SelectTrigger className="h-7 w-[180px] bg-surface-2 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MODELS.map((m) => (
              <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="border-b border-border p-3">
        <Button
          variant="ai"
          size="sm"
          className="w-full"
          disabled={running || !file}
          onClick={runScan}
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {running ? "Analyzing…" : "Scan for bugs"}
        </Button>
        {file && (
          <p className="mt-2 truncate text-center font-mono text-[11px] text-muted-foreground">
            target: {file.name} · ⌘⇧B to rescan
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!report && !running && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">No scan yet</p>
            <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
              Run a scan to surface bugs, security issues, and performance traps. Each suggested
              fix gets a diff preview and one-click apply.
            </p>
          </div>
        )}

        {report && (
          <div className="animate-fade-in space-y-4">
            <Markdown content={report} />
            {running && <span className="ml-0.5 inline-block h-3 w-1.5 animate-blink bg-primary align-middle" />}

            {/* Proposed fixes — diff + apply */}
            {!running && fixes.length > 0 && file && (
              <div className="space-y-2 border-t border-border pt-4">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <GitCompare className="h-3 w-3" /> Proposed fixes — preview + apply
                </p>
                {fixes.map((fx) => {
                  const isOpen = openFix === fx.id;
                  return (
                    <div key={fx.id} className="rounded-md border border-border bg-surface-2">
                      <button
                        className="flex w-full items-center gap-2 px-3 py-2 text-left"
                        onClick={() => setOpenFix(isOpen ? null : fx.id)}
                      >
                        {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        <span className="flex-1 truncate text-xs font-medium">{fx.title}</span>
                        <span className="rounded bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                          {fx.language}
                        </span>
                      </button>
                      {isOpen && (
                        <div className="space-y-2 border-t border-border p-3">
                          <DiffViewer before={file.content} after={fx.code} />
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={() => {
                                navigator.clipboard.writeText(fx.code);
                                toast.success("Snippet copied");
                              }}
                            >
                              Copy snippet
                            </Button>
                            <Button
                              variant="hero"
                              size="sm"
                              className="h-7 text-[11px]"
                              onClick={() => editorBus.emit({ type: "apply-fix", code: fx.code })}
                            >
                              <Wand2 className="h-3 w-3" /> Apply fix
                            </Button>
                          </div>
                          <p className="text-center text-[10.5px] text-muted-foreground">
                            Apply replaces the file contents — press ⌘Z / Ctrl+Z in the editor to undo.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
