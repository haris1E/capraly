/**
 * Inline-edit popup invoked by ⌘K when there's a selection in the editor.
 * Streams a rewrite from /functions/v1/ai-edit, then shows a Monaco-style
 * unified diff in DiffViewer with Accept / Reject. Accept replaces the
 * selection via the editor bus (undoable).
 */
import { useEffect, useRef, useState } from "react";
import { Loader2, Sparkles, X, Check } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { streamCompletion } from "@/lib/streamCompletion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import DiffViewer from "@/components/editor/DiffViewer";
import { editorBus } from "@/lib/editorBus";
import { aiThrottle } from "@/lib/aiThrottle";
import { aiErrors } from "@/lib/aiErrorStore";
import type { OpenFile } from "@/components/editor/CodeEditor";

interface SelectionInfo {
  text: string;
  startLine: number;
  endLine: number;
}

interface Props {
  file: OpenFile | null;
  selection: SelectionInfo | null;
  open: boolean;
  onClose: () => void;
}

export default function InlineEditPopup({ file, selection, open, onClose }: Props) {
  const [instruction, setInstruction] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [result, setResult] = useState("");
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (open) {
      setResult("");
      setInstruction("");
      setTimeout(() => taRef.current?.focus(), 60);
    }
  }, [open]);

  const run = async () => {
    if (!file || !selection || !instruction.trim()) return;

    const guard = aiThrottle.check("ai-edit");
    if (!guard.ok) {
      const sec = Math.ceil((guard as { retryAfterMs: number }).retryAfterMs / 1000);
      return toast.warning(`Slow down — wait ${sec}s before another edit`);
    }

    setStreaming(true);
    setResult("");
    aiThrottle.markStart("ai-edit");

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setStreaming(false);
      return toast.error("Sign in again — your session expired.");
    }
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-edit`;

    try {
      let buf = "";
      await streamCompletion({
        url,
        authToken: session.access_token,
        body: {
          selection: selection.text,
          instruction,
          language: file.language,
          filename: file.name,
          fullFile: file.content,
        },
        onDelta: (chunk) => {
          buf += chunk;
          setResult(buf);
        },
        onError: ({ status, message, rawBody }) => {
          aiErrors.push({
            status,
            message,
            endpoint: "ai-edit",
            requestSummary: `POST /ai-edit\nfile: ${file.name}\nselection: ${selection.text.length} chars`,
            rawBody,
          });
          aiThrottle.markFailure("ai-edit", status);
        },
      });
      aiThrottle.markSuccess("ai-edit");
    } catch (e: any) {
      if (e?.name !== "AbortError") console.error(e);
    } finally {
      setStreaming(false);
    }
  };

  const accept = () => {
    if (!result.trim() || !selection) return;
    // Strip accidental fences
    let code = result.trim();
    code = code.replace(/^```[\w-]*\n?/, "").replace(/```$/, "").trim();

    editorBus.emit({
      type: "apply-selection-edit",
      startLine: selection.startLine,
      endLine: selection.endLine,
      newText: code,
    });
    toast.success("Edit applied — ⌘Z to undo");
    onClose();
  };

  const reject = () => {
    setResult("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl bg-surface-1 p-0">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-ai shadow-ai">
              <Sparkles className="h-3.5 w-3.5 text-secondary-foreground" />
            </div>
            Inline Edit
            {selection && (
              <span className="ml-2 font-mono text-[11px] text-muted-foreground">
                lines {selection.startLine}–{selection.endLine}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 p-4">
          <Textarea
            ref={taRef}
            placeholder='e.g. "convert to async/await", "add JSDoc", "fix the off-by-one bug"'
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); run(); }
              if (e.key === "Escape") onClose();
            }}
            rows={2}
            className="resize-none bg-surface-2 text-sm"
            disabled={streaming}
          />
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] text-muted-foreground">
              ⌘↵ to run · Esc to close
            </p>
            <Button variant="hero" size="sm" disabled={streaming || !instruction.trim()} onClick={run}>
              {streaming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {streaming ? "Generating…" : "Generate"}
            </Button>
          </div>

          {(result || streaming) && selection && (
            <div className="space-y-2">
              <DiffViewer before={selection.text} after={result} />
              {!streaming && result && (
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={reject}>
                    <X className="h-3.5 w-3.5" /> Reject
                  </Button>
                  <Button variant="hero" size="sm" onClick={accept}>
                    <Check className="h-3.5 w-3.5" /> Accept
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
