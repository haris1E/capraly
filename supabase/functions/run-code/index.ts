// run-code — sandboxed code execution with SSE streaming.
//
//   JS / TS  →  Deno subprocess with --no-prompt and zero permissions
//   Python   →  Pyodide (WebAssembly) inside this edge runtime
//
// Both paths stream stdout / stderr to the client as Server-Sent Events
// so the in-IDE terminal can render output as it arrives. A wall-clock
// timeout (10s) and output-size cap protect the runtime. Memory is
// best-effort bounded by Pyodide's WASM heap (~200MB) and by capping
// total streamed bytes; we cannot enforce a hard RSS limit here.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  language: z.enum(["javascript", "typescript", "js", "ts", "python", "py"]),
  code: z.string().min(1).max(40_000),
  stream: z.boolean().optional(),
});

const TIMEOUT_MS = 10_000;
const MAX_OUTPUT_BYTES = 200_000;

// Reused across warm invocations to amortize Pyodide's cold start.
let pyodidePromise: Promise<any> | null = null;
async function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = (async () => {
      const { loadPyodide } = await import("npm:pyodide@0.26.4");
      const py = await loadPyodide({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/",
      });
      return py;
    })();
  }
  return pyodidePromise;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized — sign in to run code." }, 401);
  }
  const token = authHeader.slice(7);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!);
  const { data: claims, error: authErr } = await sb.auth.getClaims(token);
  if (authErr || !claims?.claims?.sub) {
    return json({ error: "Unauthorized — invalid or expired session." }, 401);
  }

  const raw = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(raw);
  if (!parsed.success) {
    return json({ error: "Invalid request body", fields: parsed.error.flatten().fieldErrors }, 400);
  }
  const { language, code, stream } = parsed.data;
  const isPython = language === "python" || language === "py";

  // Non-streaming fallback (kept for compatibility)
  if (!stream) {
    if (isPython) {
      const r = await runPythonBuffered(code);
      return json(r);
    }
    const r = await runJsBuffered(language, code);
    return json(r);
  }

  // ── SSE stream ────────────────────────────────────────────────────────────
  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      let totalBytes = 0;
      let aborted = false;
      const emit = (event: Record<string, unknown>) => {
        if (aborted) return;
        const line = `data: ${JSON.stringify(event)}\n\n`;
        const bytes = enc.encode(line);
        totalBytes += bytes.byteLength;
        if (totalBytes > MAX_OUTPUT_BYTES) {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ type: "stderr", chunk: "\n[capraly] output cap reached, stream truncated\n" })}\n\n`));
          aborted = true;
          try { controller.close(); } catch { /* noop */ }
          return;
        }
        try { controller.enqueue(bytes); } catch { aborted = true; }
      };

      const started = performance.now();
      try {
        if (isPython) {
          await runPythonStreaming(code, emit);
        } else {
          await runJsStreaming(language, code, emit);
        }
        emit({ type: "exit", code: 0, durationMs: Math.round(performance.now() - started) });
      } catch (e: any) {
        const msg = e?.message ?? String(e);
        emit({ type: "stderr", chunk: `\n${msg}\n` });
        emit({ type: "exit", code: e?.exitCode ?? 1, durationMs: Math.round(performance.now() - started) });
      } finally {
        try { controller.close(); } catch { /* noop */ }
      }
    },
  });

  return new Response(body, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
});

// ── Runners ──────────────────────────────────────────────────────────────────

async function runJsStreaming(
  language: string,
  code: string,
  emit: (e: Record<string, unknown>) => void,
) {
  const ext = (language === "typescript" || language === "ts") ? "ts" : "js";
  const tempPath = await Deno.makeTempFile({ suffix: `.${ext}` });
  await Deno.writeTextFile(tempPath, code);

  let killed = false;
  const cmd = new Deno.Command("deno", {
    args: ["run", "--no-prompt", "--quiet", tempPath],
    stdout: "piped",
    stderr: "piped",
  });
  const child = cmd.spawn();
  const timer = setTimeout(() => {
    try { child.kill("SIGKILL"); killed = true; } catch { /* noop */ }
  }, TIMEOUT_MS);

  const pump = async (reader: ReadableStreamDefaultReader<Uint8Array>, kind: "stdout" | "stderr") => {
    const dec = new TextDecoder();
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value?.byteLength) emit({ type: kind, chunk: dec.decode(value, { stream: true }) });
    }
  };

  const [statusRes] = await Promise.all([
    child.status,
    pump(child.stdout.getReader(), "stdout"),
    pump(child.stderr.getReader(), "stderr"),
  ]);

  clearTimeout(timer);
  await Deno.remove(tempPath).catch(() => {});

  if (killed) {
    emit({ type: "stderr", chunk: `\n[capraly] Execution timed out after ${TIMEOUT_MS / 1000}s.\n` });
    const err = new Error("timeout") as Error & { exitCode: number };
    err.exitCode = 124;
    throw err;
  }
  if (!statusRes.success) {
    const err = new Error(`exited with code ${statusRes.code}`) as Error & { exitCode: number };
    err.exitCode = statusRes.code;
    throw err;
  }
}

async function runPythonStreaming(
  code: string,
  emit: (e: Record<string, unknown>) => void,
) {
  const py = await getPyodide();
  py.setStdout({ batched: (s: string) => emit({ type: "stdout", chunk: s + "\n" }) });
  py.setStderr({ batched: (s: string) => emit({ type: "stderr", chunk: s + "\n" }) });

  let timer: number | undefined;
  let interrupted = false;
  // Pyodide exposes setInterruptBuffer for SAB-style cancellation; we use a
  // Promise.race with a timer flag because we don't have a SharedArrayBuffer
  // in this runtime. The Python side won't truly abort, but the response
  // stream will close and we surface a clear timeout message.
  const exec = py.runPythonAsync(code);
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { interrupted = true; reject(new Error("timeout")); }, TIMEOUT_MS) as unknown as number;
  });
  try {
    await Promise.race([exec, timeout]);
  } catch (e: any) {
    if (interrupted) {
      emit({ type: "stderr", chunk: `\n[capraly] Python execution timed out after ${TIMEOUT_MS / 1000}s.\n` });
      const err = new Error("timeout") as Error & { exitCode: number };
      err.exitCode = 124;
      throw err;
    }
    emit({ type: "stderr", chunk: String(e?.message ?? e) + "\n" });
    const err = new Error("python error") as Error & { exitCode: number };
    err.exitCode = 1;
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ── Buffered fallbacks (used when stream=false) ──────────────────────────────

async function runJsBuffered(language: string, code: string) {
  const chunks: { stdout: string; stderr: string } = { stdout: "", stderr: "" };
  let exitCode = 0;
  const started = performance.now();
  try {
    await runJsStreaming(language, code, (e) => {
      if (e.type === "stdout") chunks.stdout += e.chunk as string;
      else if (e.type === "stderr") chunks.stderr += e.chunk as string;
    });
  } catch (e: any) {
    exitCode = e?.exitCode ?? 1;
  }
  return { ...chunks, exitCode, durationMs: Math.round(performance.now() - started) };
}

async function runPythonBuffered(code: string) {
  const chunks: { stdout: string; stderr: string } = { stdout: "", stderr: "" };
  let exitCode = 0;
  const started = performance.now();
  try {
    await runPythonStreaming(code, (e) => {
      if (e.type === "stdout") chunks.stdout += e.chunk as string;
      else if (e.type === "stderr") chunks.stderr += e.chunk as string;
    });
  } catch (e: any) {
    exitCode = e?.exitCode ?? 1;
  }
  return { ...chunks, exitCode, durationMs: Math.round(performance.now() - started) };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
