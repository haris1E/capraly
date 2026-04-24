// AI Code Chat — conversational assistant aware of the current open file.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, fileContext, model } = await req.json();
    if (!Array.isArray(messages)) return json({ error: "Missing messages[]" }, 400);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY not configured" }, 500);

    const systemPrompt = `You are Capraly, an expert pair-programmer embedded in a code editor.
Be concise, accurate, and use Markdown with fenced code blocks for code.
${
  fileContext
    ? `\nCurrent open file: ${fileContext.filename} (${fileContext.language})\n\`\`\`${fileContext.language}\n${(fileContext.content || "").slice(0, 12000)}\n\`\`\``
    : ""
}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: model || "google/gemini-3-flash-preview",
        stream: true,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
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
