import { useRef, useState } from "react";
import { MessageSquare, Send, Loader2, User as UserIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { streamCompletion } from "@/lib/streamCompletion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/Markdown";
import type { OpenFile } from "@/components/editor/CodeEditor";

interface Msg { role: "user" | "assistant"; content: string }

interface Props {
  file: OpenFile | null;
}

export default function ChatPanel({ file }: Props) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);

    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/code-chat`;
    const { data: { session } } = await supabase.auth.getSession();

    let assistantText = "";
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      await streamCompletion({
        url,
        authToken: session?.access_token ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        body: {
          messages: next,
          fileContext: file ? { filename: file.name, language: file.language, content: file.content } : null,
        },
        onDelta: (chunk) => {
          assistantText += chunk;
          setMessages((m) => {
            const copy = m.slice();
            copy[copy.length - 1] = { role: "assistant", content: assistantText };
            return copy;
          });
          requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
          });
        },
        onError: ({ status, message }) => {
          if (status === 429) toast.error("Rate limit hit.");
          else if (status === 402) toast.error("AI credits exhausted.");
          else toast.error(message);
        },
      });
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-surface-1">
      <div className="flex h-12 items-center gap-2 border-b border-border px-3">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
          <MessageSquare className="h-3.5 w-3.5 text-primary" />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider">AI Chat</span>
        {file && (
          <span className="ml-auto truncate font-mono text-[11px] text-muted-foreground">
            ↳ {file.name}
          </span>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-3">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <Sparkles className="h-7 w-7 text-muted-foreground/50" />
            <p className="mt-3 text-sm font-medium">Ask about your code</p>
            <p className="mt-1 max-w-[220px] text-xs text-muted-foreground">
              "Explain this function", "How do I optimize this?", "Refactor to async/await"…
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className="animate-fade-in">
            <div className="mb-1 flex items-center gap-1.5">
              {m.role === "user" ? (
                <><UserIcon className="h-3 w-3 text-primary" /><span className="text-[10px] font-semibold uppercase tracking-wider text-primary">You</span></>
              ) : (
                <><Sparkles className="h-3 w-3 text-secondary-glow" /><span className="text-[10px] font-semibold uppercase tracking-wider text-secondary-glow">Capraly AI</span></>
              )}
            </div>
            <div className="rounded-lg bg-surface-2 p-2.5 text-sm">
              {m.role === "assistant" && m.content === "" ? (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : (
                <Markdown content={m.content} />
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-border p-2">
        <div className="flex gap-1.5">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Ask anything…"
            rows={2}
            className="resize-none bg-surface-2 text-xs"
          />
          <Button variant="hero" size="icon" disabled={busy || !input.trim()} onClick={send}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
