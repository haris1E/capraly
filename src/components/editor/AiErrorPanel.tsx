import { useState } from "react";
import { AlertOctagon, X, Copy, ChevronDown, ChevronRight, Timer, RefreshCw } from "lucide-react";
import { useAiError, aiErrors, retryGuidance } from "@/lib/aiErrorStore";
import { useThrottleTick, aiThrottle } from "@/lib/aiThrottle";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { editorBus } from "@/lib/editorBus";

/**
 * Floating AI error panel — surfaces the latest 4xx/5xx response from the
 * edge functions with full request/response context and retry guidance.
 *
 * Renders as a dismissible card pinned to the bottom-right; only visible
 * when there's a stored error.
 */
export default function AiErrorPanel() {
  const err = useAiError();
  useThrottleTick(); // re-render to animate countdown
  const [expanded, setExpanded] = useState(true);
  const [showRaw, setShowRaw] = useState(false);

  if (!err) return null;

  const remainingMs = err.blockedUntil ? Math.max(0, err.blockedUntil - Date.now()) : 0;
  const remainingSec = Math.ceil(remainingMs / 1000);

  const tone =
    err.status === 429 ? "border-warning/50 shadow-[0_0_30px_-10px_hsl(var(--warning)/0.5)]" :
    err.status === 402 ? "border-destructive/50 shadow-[0_0_30px_-10px_hsl(var(--destructive)/0.5)]" :
    "border-border";

  return (
    <div className={`pointer-events-auto fixed bottom-4 right-4 z-50 w-[360px] rounded-lg border ${tone} bg-surface-1/95 backdrop-blur`}>
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <AlertOctagon className={`h-4 w-4 shrink-0 ${err.status === 429 ? "text-warning" : "text-destructive"}`} />
        <div className="flex-1 truncate">
          <p className="truncate text-xs font-semibold">
            AI error · {err.status ?? "?"} · {err.endpoint}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{err.message}</p>
        </div>
        {expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
        <button
          onClick={(e) => { e.stopPropagation(); aiErrors.clear(); }}
          className="rounded p-0.5 text-muted-foreground hover:bg-surface-3 hover:text-foreground"
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-border px-3 py-3 text-[12px]">
          <Field label="Endpoint">
            <code className="font-mono text-primary">/functions/v1/{err.endpoint}</code>
          </Field>
          <Field label="When">
            {new Date(err.timestamp).toLocaleTimeString()}
          </Field>
          <Field label="Request">
            <code className="block whitespace-pre-wrap break-words font-mono text-[11px] text-muted-foreground">
              {err.requestSummary}
            </code>
          </Field>
          <Field label="What to do">
            <p className="text-muted-foreground">{retryGuidance(err.status)}</p>
          </Field>

          {remainingMs > 0 && (
            <div className="flex items-center gap-2 rounded-md border border-warning/40 bg-warning/5 px-2.5 py-2">
              <Timer className="h-3.5 w-3.5 shrink-0 text-warning" />
              <div className="flex-1">
                <p className="text-[11px] font-semibold text-warning">Cooling down</p>
                <p className="text-[10.5px] text-muted-foreground">
                  Retries are paused to avoid burning credits. Try again in <span className="font-mono text-warning">{remainingSec}s</span>.
                </p>
              </div>
            </div>
          )}

          {remainingMs === 0 && err.endpoint && (
            <div className="flex items-center gap-2 rounded-md border border-primary/40 bg-primary/5 px-2.5 py-2">
              <RefreshCw className="h-3.5 w-3.5 shrink-0 text-primary" />
              <div className="flex-1">
                <p className="text-[11px] font-semibold text-primary">Ready to retry</p>
                <p className="text-[10.5px] text-muted-foreground">
                  The cooldown has ended. You can now retry the failed request.
                </p>
              </div>
              <Button
                variant="hero"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => {
                  aiErrors.clear();
                  editorBus.emit("retry", { endpoint: err.endpoint });
                }}
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Retry now
              </Button>
            </div>
          )}

          {err.rawBody && (
            <div>
              <button
                onClick={() => setShowRaw((s) => !s)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {showRaw ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                Raw response
              </button>
              {showRaw && (
                <div className="mt-1.5 rounded-md border border-border bg-[#0d1219] p-2">
                  <pre className="max-h-[120px] overflow-auto font-mono text-[10.5px] text-muted-foreground">
                    {err.rawBody}
                  </pre>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[11px]"
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(err, null, 2));
                toast.success("Error context copied");
              }}
            >
              <Copy className="h-3 w-3" /> Copy
            </Button>
            <Button variant="subtle" size="sm" className="h-7 text-[11px]" onClick={() => aiErrors.clear()}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{label}</p>
      <div>{children}</div>
    </div>
  );
}
