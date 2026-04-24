/**
 * Parse the AI Bug Finder Markdown report into fix proposals.
 *
 * Each proposal corresponds to a fenced code block (```lang ... ```), tied
 * to the nearest preceding `### …` heading so the user can preview a diff
 * against the active file before applying.
 */
export interface FixProposal {
  id: string;
  title: string;
  language: string;
  code: string;
}

export function parseFixSnippets(markdown: string): FixProposal[] {
  const blocks: FixProposal[] = [];
  // Match every fenced block. For each, look back to find the closest "### …" heading.
  const fence = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  let idx = 0;
  while ((m = fence.exec(markdown))) {
    const lang = (m[1] || "").trim() || "plaintext";
    const code = m[2];
    const before = markdown.slice(0, m.index);
    const headingMatch = [...before.matchAll(/^###\s+(.+)$/gm)].pop();
    const title = headingMatch?.[1]?.trim() ?? `Fix #${idx + 1}`;
    blocks.push({
      id: `fix-${idx}`,
      title: stripEmoji(title),
      language: lang,
      code: code.replace(/\n$/, ""),
    });
    idx++;
  }
  return blocks;
}

function stripEmoji(s: string) {
  // Remove leading severity emojis like 🔴 🟠 🟡 🟢 🔵 ⚠️
  return s.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\u26A0\uFE0F\s]+/u, "").trim();
}
