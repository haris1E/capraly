// run-code — sandboxed code execution for the in-IDE terminal.
// Supports JavaScript / TypeScript via Deno subprocess with --no-prompt
// and zero permissions. 10s wall-clock timeout. Captures stdout + stderr.
//
// Python is intentionally NOT available in the edge runtime; we surface a
// clear "not supported" message so the UI can guide the user.

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
});

const TIMEOUT_MS = 10_000;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Auth
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

  try {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return json({ error: "Invalid request body", fields: parsed.error.flatten().fieldErrors }, 400);
    }
    const { language, code } = parsed.data;

    if (language === "python" || language === "py") {
      return json({
        stdout: "",
        stderr: "Python execution is not yet supported in the sandbox. JS/TS only for now.",
        exitCode: 1,
        durationMs: 0,
      });
    }

    const ext = (language === "typescript" || language === "ts") ? "ts" : "js";
    const tempPath = await Deno.makeTempFile({ suffix: `.${ext}` });
    await Deno.writeTextFile(tempPath, code);

    const started = performance.now();
    let killed = false;

    // Spawn deno with NO permissions for safety
    const cmd = new Deno.Command("deno", {
      args: ["run", "--no-prompt", "--quiet", tempPath],
      stdout: "piped",
      stderr: "piped",
    });
    const child = cmd.spawn();

    // Timeout watcher
    const timer = setTimeout(() => {
      try { child.kill("SIGKILL"); killed = true; } catch { /* ignore */ }
    }, TIMEOUT_MS);

    const { stdout, stderr, code: exitCode } = await child.output();
    clearTimeout(timer);
    await Deno.remove(tempPath).catch(() => {});

    const decoder = new TextDecoder();
    let outStr = decoder.decode(stdout);
    let errStr = decoder.decode(stderr);

    if (killed) {
      errStr += `\n[capraly] Execution timed out after ${TIMEOUT_MS / 1000}s and was killed.`;
    }

    // Cap output size so the terminal doesn't get flooded
    const cap = 20_000;
    if (outStr.length > cap) outStr = outStr.slice(0, cap) + `\n[capraly] stdout truncated (${outStr.length - cap} more chars)`;
    if (errStr.length > cap) errStr = errStr.slice(0, cap) + `\n[capraly] stderr truncated (${errStr.length - cap} more chars)`;

    return json({
      stdout: outStr,
      stderr: errStr,
      exitCode: killed ? 124 : exitCode,
      durationMs: Math.round(performance.now() - started),
    });
  } catch (e) {
    console.error("run-code error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
