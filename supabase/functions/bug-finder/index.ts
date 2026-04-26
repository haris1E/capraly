// AI Bug Finder — analyzes a code file and streams structured findings.
// Calls Lovable AI Gateway (no extra API key — LOVABLE_API_KEY is preset).
// Requires a valid Supabase session — no anonymous calls allowed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Allowlist — must mirror MODELS in src/components/editor/BugFinder.tsx.
// Prevents authenticated users from enumerating or invoking arbitrary
// (potentially expensive) models on the gateway.
const ALLOWED_MODELS = new Set([
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-pro",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "openai/gpt-5",
]);

const BodySchema = z.object({
  code: z.string().min(1).max(60_000),
  language: z.string().max(40).optional(),
  filename: z.string().max(255).optional(),
  model: z
    .string()
    .max(80)
    .refine((m) => ALLOWED_MODELS.has(m), { message: "Unknown model" })
    .optional(),
});

const SYSTEM_PROMPT = `You are an elite senior code reviewer.
Analyze the provided source file and:
1. Identify real bugs, security issues, performance problems, and bad patterns.
2. For each issue: state line(s), severity (low/medium/high/critical), category (bug/security/performance/style), explain WHY clearly, and provide a corrected snippet.
3. End with a SHORT overall assessment.

Use this exact Markdown structure:

## Summary
<one paragraph>

## Issues
### 🔴 [Severity · Category] Title (lines X-Y)
**Why:** explanation
\`\`\`<lang>
// fixed code
\`\`\`

If there are no issues, say so plainly and suggest one improvement.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── Auth: require a valid Supabase JWT ──────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized — sign in to use the AI bug finder." }, 401);
  }
  const token = authHeader.slice(7);
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: claims, error: authErr } = await sb.auth.getClaims(token);
  if (authErr || !claims?.claims?.sub) {
    return json({ error: "Unauthorized — invalid or expired session." }, 401);
  }

  try {
    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      return json({ error: "Invalid request body", fields: flat.fieldErrors }, 400);
    }
    const { code, language, filename, model } = parsed.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const userMsg = `File: ${filename ?? "untitled"}
Language: ${language ?? "unknown"}

\`\`\`${language ?? ""}
${code}
\`\`\`

Review this file for bugs and issues.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "google/gemini-3-flash-preview",
        stream: true,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMsg },
        ],
      }),
    });

    if (response.status === 429) return json({ error: "Rate limit hit. Try again in a moment." }, 429);
    if (response.status === 402) return json({ error: "AI credits exhausted. Add funds in Workspace → Usage." }, 402);
    if (!response.ok) {
      console.error("AI gateway error:", response.status, await response.text());
      return json({ error: "AI gateway error" }, 500);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("bug-finder error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
