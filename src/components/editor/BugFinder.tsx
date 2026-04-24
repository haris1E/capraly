import { useRef, useState } from "react";
import { Bug, Loader2, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { streamCompletion } from "@/lib/streamCompletion";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Markdown } from "@/components/Markdown";
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
  const abortRef = useRef<AbortController | null>(null);

  const runScan = async () => {
    if (!file) return toast.error("Open a file first");
    if (!file.content.trim()) return toast.error("File is empty");

    setRunning(true);
    setReport("");
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bug-finder`;
    const { data: { session } } = await supabase.auth.getSession();

    try {
      await streamCompletion({
        url,
        signal: controller.signal,
        authToken: session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        body: {
          code: file.content,
          language: file.language,
          filename: file.name,
          model,
        },
        onDelta: (chunk) => setReport((r) => r + chunk),
        onError: ({ status, message }) => {
          if (status === 429) toast.error("Rate limit hit — try again in a moment.");
          else if (status === 402) toast.error("AI credits exhausted. Add credits in Workspace → Usage.");
          else toast.error(message);
        },
      });
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error(e);
    } finally {
      setRunning(false);
    }
  };

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
            target: {file.name}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!report && !running && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <AlertTriangle className="h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">No scan yet</p>
            <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">
              Run a scan to surface bugs, security issues, and performance traps in your code.
            </p>
          </div>
        )}
        {report && (
          <div className="animate-fade-in">
            <Markdown content={report} />
            {running && <span className="ml-0.5 inline-block h-3 w-1.5 animate-blink bg-primary align-middle" />}
          </div>
        )}
      </div>
    </div>
  );
}
