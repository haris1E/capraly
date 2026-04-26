/**
 * In-IDE terminal. Uses xterm.js for the visual surface and calls the
 * `run-code` edge function to execute the active file's contents in a
 * Deno sandbox (10s timeout, no permissions, JS/TS only). Output is
 * appended to the terminal and color-coded.
 */
import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { Play, StopCircle, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { editorBus } from "@/lib/editorBus";
import type { OpenFile } from "@/components/editor/CodeEditor";

interface Props {
  file: OpenFile | null;
}

const PROMPT = "\x1b[38;5;81mcapraly\x1b[0m \x1b[38;5;245m›\x1b[0m ";

export default function TerminalPanel({ file }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [running, setRunning] = useState(false);

  // Mount xterm once
  useEffect(() => {
    if (!containerRef.current || termRef.current) return;
    const term = new XTerm({
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 12,
      theme: {
        background: "#0d1219",
        foreground: "#e6edf3",
        cursor: "#5fd4ff",
        black: "#0d1219",
        red: "#ff7b7b",
        green: "#7ee787",
        yellow: "#f5a97f",
        blue: "#5fd4ff",
        magenta: "#b388ff",
        cyan: "#5fd4ff",
        white: "#e6edf3",
      },
      cursorBlink: true,
      convertEol: true,
      scrollback: 2000,
      disableStdin: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    try { fit.fit(); } catch { /* noop */ }
    term.writeln("\x1b[38;5;245mCapraly Terminal · Deno sandbox · 10s timeout\x1b[0m");
    term.write(PROMPT);

    termRef.current = term;
    fitRef.current = fit;

    const onResize = () => { try { fit.fit(); } catch { /* noop */ } };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      term.dispose();
      termRef.current = null;
    };
  }, []);

  // Re-fit when the panel becomes visible / file changes
  useEffect(() => {
    const t = setTimeout(() => { try { fitRef.current?.fit(); } catch { /* noop */ } }, 60);
    return () => clearTimeout(t);
  }, [file?.id]);

  const writeLine = (s: string, color?: string) => {
    if (!termRef.current) return;
    const lines = s.split("\n");
    for (const line of lines) {
      if (color) termRef.current.writeln(`\x1b[${color}m${line}\x1b[0m`);
      else termRef.current.writeln(line);
    }
  };

  const clear = () => {
    termRef.current?.clear();
    termRef.current?.write(PROMPT);
  };

  const run = async () => {
    if (!file) return toast.error("Open a file first");
    const lang = file.language;
    const supported = ["javascript", "typescript", "js", "ts"].includes(lang);
    if (!supported) {
      writeLine(`> ${file.name}`, "38;5;245");
      writeLine(`Language "${lang}" is not runnable in the sandbox (JS/TS only).`, "38;5;203");
      termRef.current?.write(PROMPT);
      return;
    }

    setRunning(true);
    writeLine(`$ run ${file.name}`, "38;5;81");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setRunning(false); return toast.error("Session expired"); }

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-code`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ language: lang, code: file.content }),
        },
      );
      const data = await resp.json();

      if (!resp.ok) {
        writeLine(`✗ ${data?.error ?? `HTTP ${resp.status}`}`, "38;5;203");
      } else {
        if (data.stdout) writeLine(data.stdout);
        if (data.stderr) writeLine(data.stderr, "38;5;203");
        writeLine(
          `→ exit ${data.exitCode} · ${data.durationMs}ms`,
          data.exitCode === 0 ? "38;5;114" : "38;5;203",
        );
      }
    } catch (e: any) {
      writeLine(`✗ ${e?.message ?? "Network error"}`, "38;5;203");
    } finally {
      setRunning(false);
      termRef.current?.write(PROMPT);
    }
  };

  // Listen for global "run" events
  useEffect(() => {
    return editorBus.on((e) => {
      if (e.type === "run-active-file") run();
      if (e.type === "clear-terminal") clear();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id, file?.content]);

  return (
    <div className="flex h-full flex-col bg-[#0d1219]">
      <div className="flex h-9 items-center gap-2 border-b border-border bg-surface-1 px-3">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Terminal</span>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          {file ? `· ${file.name}` : ""}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={run}
            disabled={running || !file}
          >
            {running ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
            Run <span className="ml-1 font-mono text-[9px] text-muted-foreground">⌘↵</span>
          </Button>
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={clear}>
            <Trash2 className="h-3 w-3" /> Clear
          </Button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden p-2" />
    </div>
  );
}
