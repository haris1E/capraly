import { useEffect, useRef, useState } from "react";
import { MessageSquare, Send, Loader2, User as UserIcon, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { streamCompletion } from "@/lib/streamCompletion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Markdown } from "@/components/Markdown";
import { aiErrors } from "@/lib/aiErrorStore";
import { aiThrottle } from "@/lib/aiThrottle";
import { editorBus } from "@/lib/editorBus";
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
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;

    // Client-side throttle — prevent rapid-fire sends after a 429/402.
    const guard = aiThrottle.check("code-chat");
    if (!guard.ok) {
      const sec = Math.ceil((guard as { retryAfterMs: number }).retryAfterMs / 1000);
      toast.warning(
        (guard as { reason: "blocked" | "cooldown" }).reason === "blocked"
          ? `Cooling down — retry in ${sec}s`
          : `Slow down — wait ${sec}s before sending again`,
      );
      return;
    }

    setInput("");
    setBusy(true);
    aiThrottle.markStart("code-chat");

    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(next);

    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/code-chat`;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setBusy(false);
      return toast.error("Sign in again — your session expired.");
    }

    const requestSummary = `POST /functions/v1/code-chat
messages: ${next.length}
file: ${file?.name ?? "(none)"}`;

    let assistantText = "";
    setMessages((m) => [...m, { role: "assistant", content: "" }]);

    try {
      await streamCompletion({
        url,
        authToken: session.access_token,
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
        onError: ({ status, message, rawBody }) => {
          aiErrors.push({
            status,
            message,
            endpoint: "code-chat",
            requestSummary,
            rawBody,
          });
          aiThrottle.markFailure("code-chat", status);
        },
      });
      aiThrottle.markSuccess("code-chat");
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
            <p className="mt-1 max-w-[240px] text-xs text-muted-foreground">
              "Explain this function", "How do I optimize this?", "Refactor to async/await"…
            </p>
            <p className="mt-3 font-mono text-[10px] text-muted-foreground/70">⌘J to focus this panel</p>
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
            ref={inputRef}
            data-chat-input
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
