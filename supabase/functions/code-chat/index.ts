// AI Code Chat — conversational assistant aware of the current open file.
// Requires a valid Supabase session — no anonymous calls allowed.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Allowlist — must mirror MODELS in src/components/editor/BugFinder.tsx.
const ALLOWED_MODELS = new Set([
  "google/gemini-3-flash-preview",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "google/gemini-2.5-pro",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "openai/gpt-5",
]);

// Strictly limit roles to user/assistant — never let clients inject
// `system` messages (which would override our system prompt and enable
// instruction-bypass / jailbreak attempts).
const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(20_000),
});

const FileContextSchema = z
  .object({
    filename: z.string().max(255).optional().nullable(),
    language: z.string().max(40).optional().nullable(),
    content: z.string().max(40_000).optional().nullable(),
  })
  .nullable()
  .optional();

const BodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
  fileContext: FileContextSchema,
  model: z
    .string()
    .max(80)
    .refine((m) => ALLOWED_MODELS.has(m), { message: "Unknown model" })
    .optional(),
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── Auth: require a valid Supabase JWT ──────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return json({ error: "Unauthorized — sign in to use chat." }, 401);
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
    const { messages, fileContext, model } = parsed.data;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const systemPrompt = `You are Capraly, an expert pair-programmer embedded in a code editor.
Be concise, accurate, and use Markdown with fenced code blocks for code.
${
  fileContext && fileContext.filename
    ? `\nCurrent open file: ${fileContext.filename} (${fileContext.language ?? "unknown"})\n\`\`\`${fileContext.language ?? ""}\n${(fileContext.content || "").slice(0, 12000)}\n\`\`\``
    : ""
}`;

    // Re-shape messages defensively — only role + content are forwarded.
    const safeMessages = messages.map((m) => ({ role: m.role, content: m.content }));

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "google/gemini-3-flash-preview",
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, ...safeMessages],
      }),
    });

    if (response.status === 429) return json({ error: "Rate limit hit. Try again shortly." }, 429);
    if (response.status === 402) return json({ error: "AI credits exhausted." }, 402);
    if (!response.ok) {
      console.error("AI chat error:", response.status, await response.text());
      return json({ error: "AI gateway error" }, 500);
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("code-chat error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
