/**
 * In-IDE terminal. Renders with xterm.js and streams output from the
 * `run-code` edge function over Server-Sent Events. Supports JS/TS via
 * a sandboxed Deno subprocess and Python via Pyodide in the edge runtime.
 * Wall-clock timeout 10s; output is byte-capped server-side.
 */
import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { Play, Trash2, Loader2, Square } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { editorBus } from "@/lib/editorBus";
import type { OpenFile } from "@/components/editor/CodeEditor";

interface Props {
  file: OpenFile | null;
}

const PROMPT = "\x1b[38;5;81mcapraly\x1b[0m \x1b[38;5;245m›\x1b[0m ";
const RUNNABLE = new Set(["javascript", "typescript", "js", "ts", "python", "py"]);

export default function TerminalPanel({ file }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [running, setRunning] = useState(false);

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
      scrollback: 5000,
      disableStdin: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    try { fit.fit(); } catch { /* noop */ }
    term.writeln("\x1b[38;5;245mCapraly Terminal · JS/TS + Python (Pyodide) · 10s timeout\x1b[0m");
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

  useEffect(() => {
    const t = setTimeout(() => { try { fitRef.current?.fit(); } catch { /* noop */ } }, 60);
    return () => clearTimeout(t);
  }, [file?.id]);

  const writeChunk = (s: string, color?: string) => {
    if (!termRef.current) return;
    const text = color ? `\x1b[${color}m${s}\x1b[0m` : s;
    termRef.current.write(text.replace(/\n/g, "\r\n"));
  };
  const writeLine = (s: string, color?: string) => {
    writeChunk(s + "\n", color);
  };

  const clear = () => {
    termRef.current?.clear();
    termRef.current?.write(PROMPT);
  };

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const run = async () => {
    if (!file) return toast.error("Open a file first");
    if (running) return;

    const lang = file.language;
    if (!RUNNABLE.has(lang)) {
      writeLine(`$ run ${file.name}`, "38;5;81");
      writeLine(`Language "${lang}" is not runnable (JS, TS, and Python only).`, "38;5;203");
      termRef.current?.write(PROMPT);
      return;
    }

    setRunning(true);
    writeLine(`$ run ${file.name}`, "38;5;81");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setRunning(false); return toast.error("Session expired"); }

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const started = performance.now();

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/run-code`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "text/event-stream",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ language: lang, code: file.content, stream: true }),
          signal: ctrl.signal,
        },
      );

      if (!resp.ok || !resp.body) {
        const txt = await resp.text().catch(() => "");
        writeLine(`✗ ${txt || `HTTP ${resp.status}`}`, "38;5;203");
        return;
      }

      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let exitCode: number | null = null;
      let durationMs = 0;

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        // SSE events separated by blank line
        while ((idx = buf.indexOf("\n\n")) !== -1) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          let evt: any;
          try { evt = JSON.parse(dataLine.slice(5).trim()); } catch { continue; }
          if (evt.type === "stdout") writeChunk(evt.chunk);
          else if (evt.type === "stderr") writeChunk(evt.chunk, "38;5;203");
          else if (evt.type === "exit") { exitCode = evt.code; durationMs = evt.durationMs; }
        }
      }

      if (exitCode === null) {
        writeLine(`→ stream ended · ${Math.round(performance.now() - started)}ms`, "38;5;245");
      } else {
        writeLine(
          `→ exit ${exitCode} · ${durationMs}ms`,
          exitCode === 0 ? "38;5;114" : "38;5;203",
        );
      }
    } catch (e: any) {
      if (e?.name === "AbortError") writeLine("✗ stopped", "38;5;203");
      else writeLine(`✗ ${e?.message ?? "Network error"}`, "38;5;203");
    } finally {
      setRunning(false);
      abortRef.current = null;
      termRef.current?.write(PROMPT);
    }
  };

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
          {running ? (
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={stop}>
              <Square className="h-3 w-3" /> Stop
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={run}
              disabled={!file}
            >
              <Play className="h-3 w-3" />
              Run <span className="ml-1 font-mono text-[9px] text-muted-foreground">⌘↵</span>
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]" onClick={clear}>
            <Trash2 className="h-3 w-3" /> Clear
          </Button>
        </div>
      </div>
      <div ref={containerRef} className="flex-1 overflow-hidden p-2" />
      {running && (
        <div className="flex items-center gap-1.5 border-t border-border bg-surface-1 px-3 py-1 text-[10px] text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> streaming…
        </div>
      )}
    </div>
  );
}
