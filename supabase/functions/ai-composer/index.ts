// AI Composer — given a high-level instruction and the project's current
// files, asks the model to plan a multi-file change. Returns a structured
// JSON plan so the client can render diffs and apply atomically.
//
// Non-streaming (we need the full structured tool call before applying).

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
  "google/gemini-2.5-pro",
  "openai/gpt-5-mini",
  "openai/gpt-5",
]);

const FileSchema = z.object({
  name: z.string().min(1).max(255),
  language: z.string().max(40).optional(),
  content: z.string().max(60_000),
});

const BodySchema = z.object({
  instruction: z.string().min(1).max(4_000),
  files: z.array(FileSchema).max(40),
  model: z.string().max(80).refine((m) => ALLOWED_MODELS.has(m), { message: "Unknown model" }).optional(),
});

const SYSTEM = `You are Capraly Composer — an AI that proposes multi-file edits inside a project.

Given a project's current files and an instruction, produce a precise plan that
either CREATES new files or REPLACES the full content of existing files.

Be conservative — only touch files that need changes. Keep names matching the
project's conventions. For new files, pick a sensible name and language.

ALWAYS respond by calling the propose_changes tool exactly once.`;

const TOOLS = [
  {
    type: "function",
    function: {
      name: "propose_changes",
      description: "Propose a set of file create/replace operations.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "One-paragraph plain-English summary of the change." },
          changes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                op: { type: "string", enum: ["create", "replace"] },
                name: { type: "string", description: "File name including extension." },
                language: { type: "string", description: "Language slug e.g. typescript, javascript, python." },
                content: { type: "string", description: "Full file content after the change." },
                rationale: { type: "string", description: "Why this change is needed." },
              },
              required: ["op", "name", "content", "rationale"],
              additionalProperties: false,
            },
          },
        },
        required: ["summary", "changes"],
        additionalProperties: false,
      },
    },
  },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized — sign in to use Composer." }, 401);
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
    const { instruction, files, model } = parsed.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const projectDump = files
      .map((f) => `--- FILE: ${f.name} (${f.language ?? "?"}) ---\n${f.content}`)
      .join("\n\n")
      .slice(0, 80_000);

    const userMsg = `CURRENT PROJECT FILES:
${projectDump || "(empty project)"}

INSTRUCTION:
${instruction}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: userMsg },
        ],
        tools: TOOLS,
        tool_choice: { type: "function", function: { name: "propose_changes" } },
      }),
    });

    if (resp.status === 429) return json({ error: "Rate limit hit. Try again shortly." }, 429);
    if (resp.status === 402) return json({ error: "AI credits exhausted." }, 402);
    if (!resp.ok) {
      const txt = await resp.text();
      console.error("ai-composer gateway error:", resp.status, txt);
      return json({ error: "AI gateway error" }, 500);
    }

    const data = await resp.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsRaw = toolCall?.function?.arguments;
    if (!argsRaw) return json({ error: "Model returned no plan" }, 502);

    let plan: unknown;
    try { plan = JSON.parse(argsRaw); }
    catch { return json({ error: "Model returned invalid JSON plan" }, 502); }

    return json({ plan });
  } catch (e) {
    console.error("ai-composer error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
