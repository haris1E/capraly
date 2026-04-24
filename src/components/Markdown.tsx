import { useMemo } from "react";

/**
 * Minimal, dependency-free Markdown renderer with code-block support.
 * Good enough for streaming AI responses without heavy libraries.
 */
export function Markdown({ content }: { content: string }) {
  const blocks = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className="prose prose-invert prose-sm max-w-none prose-pre:bg-transparent prose-pre:p-0 prose-code:text-primary prose-headings:font-display prose-headings:tracking-tight">
      {blocks.map((b, i) => {
        if (b.type === "code") {
          return (
            <pre key={i} className="my-2 overflow-x-auto rounded-md border border-border bg-[#0d1219] p-3 font-mono text-[12px] leading-relaxed">
              <code>{b.content}</code>
            </pre>
          );
        }
        return (
          <div
            key={i}
            className="text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderInline(b.content) }}
          />
        );
      })}
    </div>
  );
}

type Block = { type: "text" | "code"; content: string; lang?: string };

function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = [];
  const re = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) blocks.push({ type: "text", content: src.slice(last, m.index) });
    blocks.push({ type: "code", content: m[2], lang: m[1] });
    last = m.index + m[0].length;
  }
  // Tail (might be unterminated code block during streaming)
  if (last < src.length) {
    const tail = src.slice(last);
    const openIdx = tail.lastIndexOf("```");
    if (openIdx !== -1 && tail.indexOf("```", openIdx + 3) === -1) {
      // Unterminated — render text part and code-in-progress as code block
      const before = tail.slice(0, openIdx);
      if (before) blocks.push({ type: "text", content: before });
      const codeStart = tail.indexOf("\n", openIdx) + 1;
      blocks.push({ type: "code", content: tail.slice(codeStart) });
    } else {
      blocks.push({ type: "text", content: tail });
    }
  }
  return blocks;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function renderInline(text: string) {
  let html = escapeHtml(text);
  // Headings
  html = html.replace(/^### (.+)$/gm, '<h4 class="mt-3 mb-1 font-semibold text-foreground">$1</h4>');
  html = html.replace(/^## (.+)$/gm, '<h3 class="mt-3 mb-1 text-base font-bold text-gradient-primary">$1</h3>');
  html = html.replace(/^# (.+)$/gm, '<h2 class="mt-3 mb-2 text-lg font-bold">$1</h2>');
  // Bold / italic / inline code
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, '<code class="rounded bg-surface-3 px-1 py-0.5 font-mono text-[12px] text-primary">$1</code>');
  // Lists
  html = html.replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');
  // Line breaks
  html = html.replace(/\n/g, "<br/>");
  return html;
}
