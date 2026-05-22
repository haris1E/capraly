/**
 * Top toolbar — CMD+K, Run, Share, Deploy. The CMD+K button opens the
 * inline-edit popup (when there's a selection) or a hint toast otherwise.
 */
import { Sparkles, Play, Share2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { editorBus } from "@/lib/editorBus";

interface Props {
  fileName?: string;
}

export default function TopBar({ fileName }: Props) {
  const share = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface-1 px-3">
      <span className="text-xs text-muted-foreground">
        {fileName ? <span className="font-mono">{fileName}</span> : "No file open"}
      </span>

      <div className="ml-auto flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 bg-surface-2 text-xs"
          onClick={() => editorBus.emit({ type: "open-cmdk" })}
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span>Edit with AI</span>
          <span className="font-mono text-[10px] text-muted-foreground">⌘K</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => editorBus.emit({ type: "run-active-file" })}
        >
          <Play className="h-3.5 w-3.5 text-success" /> Run
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={share}
        >
          <Share2 className="h-3.5 w-3.5" /> Share
        </Button>

        <Button
          variant="hero"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => editorBus.emit({ type: "open-deploy" })}
        >
          <Rocket className="h-3.5 w-3.5" /> Deploy
        </Button>

      </div>
    </div>
  );
}
