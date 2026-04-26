// CMD+K Inline Edit — receives selected code + an instruction, returns
// the rewritten snippet (no fences, no commentary). Caller renders a Monaco
// diff and lets the user Accept / Reject.
//
// Streaming, JWT-validated, allowlisted models, strict input validation.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.104.1";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
  selection: z.string().min(1).max(40_000),
  instruction: z.string().min(1).max(2_000),
  language: z.string().max(40).optional(),
  filename: z.string().max(255).optional(),
  fullFile: z.string().max(60_000).optional(),
  model: z.string().max(80).refine((m) => ALLOWED_MODELS.has(m), { message: "Unknown model" }).optional(),
});

const SYSTEM = `You are an inline code-edit AI inside an IDE.
You will be given (a) the entire file for context, (b) a SELECTED region, and (c) an instruction.
Return ONLY the rewritten replacement for the SELECTED region.
Rules:
- Preserve original indentation of the selection.
- Do NOT wrap your output in Markdown fences.
- Do NOT add commentary, headings, or explanations.
- If the instruction asks for an explanation, still return the code only.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized — sign in to use inline edit." }, 401);
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
    const { selection, instruction, language, filename, fullFile, model } = parsed.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const userMsg = `FILE: ${filename ?? "untitled"} (${language ?? "unknown"})

FULL FILE FOR CONTEXT:
\`\`\`${language ?? ""}
${(fullFile ?? selection).slice(0, 30_000)}
\`\`\`

SELECTED REGION TO REWRITE:
\`\`\`${language ?? ""}
${selection}
\`\`\`

INSTRUCTION:
${instruction}

Return ONLY the replacement for the SELECTED REGION. No fences, no prose.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "google/gemini-3-flash-preview",
        stream: true,
        messages: [{ role: "system", content: SYSTEM }, { role: "user", content: userMsg }],
      }),
    });

    if (response.status === 429) return json({ error: "Rate limit hit. Try again shortly." }, 429);
    if (response.status === 402) return json({ error: "AI credits exhausted." }, 402);
    if (!response.ok) {
      console.error("ai-edit gateway error:", response.status, await response.text());
      return json({ error: "AI gateway error" }, 500);
    }

    return new Response(response.body, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
  } catch (e) {
    console.error("ai-edit error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
