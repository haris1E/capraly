import { useMemo } from "react";
import { diffLines, diffStats, type DiffLine } from "@/lib/diff";
import { cn } from "@/lib/utils";

interface Props {
  before: string;
  after: string;
  className?: string;
}

/**
 * Compact unified diff viewer with line numbers and add/delete highlighting.
 * Designed to live inside the AI Bug Finder so the user can preview each
 * proposed fix snippet against the active file before applying it.
 */
export default function DiffViewer({ before, after, className }: Props) {
  const lines: DiffLine[] = useMemo(() => diffLines(before, after), [before, after]);
  const stats = useMemo(() => diffStats(lines), [lines]);

  let leftNum = 0;
  let rightNum = 0;

  return (
    <div className={cn("overflow-hidden rounded-md border border-border bg-[#0d1219]", className)}>
      <div className="flex items-center gap-3 border-b border-border bg-surface-2 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Diff</span>
        <span className="text-success">+{stats.added}</span>
        <span className="text-destructive">−{stats.removed}</span>
      </div>
      <pre className="max-h-[260px] overflow-auto p-0 font-mono text-[11.5px] leading-[1.55]">
        {lines.map((l, i) => {
          if (l.op === "del") leftNum++;
          else if (l.op === "add") rightNum++;
          else { leftNum++; rightNum++; }

          const bg =
            l.op === "add" ? "bg-success/10 text-success" :
            l.op === "del" ? "bg-destructive/10 text-destructive" :
            "text-foreground/70";
          const sign = l.op === "add" ? "+" : l.op === "del" ? "−" : " ";

          return (
            <div key={i} className={cn("flex px-2", bg)}>
              <span className="w-7 shrink-0 select-none text-right text-muted-foreground/60">
                {l.op === "add" ? "" : leftNum}
              </span>
              <span className="mx-2 w-7 shrink-0 select-none text-right text-muted-foreground/60">
                {l.op === "del" ? "" : rightNum}
              </span>
              <span className="mr-2 w-3 shrink-0 select-none">{sign}</span>
              <span className="whitespace-pre-wrap break-all">{l.text || " "}</span>
            </div>
          );
        })}
      </pre>
    </div>
  );
}
