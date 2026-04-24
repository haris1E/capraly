/**
 * Tiny line-diff utility — LCS-based, dependency-free.
 * Returns an array of segments tagged add / del / eq, suitable for a
 * side-by-side or unified diff viewer.
 */
export type DiffOp = "eq" | "add" | "del";
export interface DiffLine { op: DiffOp; text: string }

export function diffLines(a: string, b: string): DiffLine[] {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const n = aLines.length, m = bLines.length;

  // LCS DP table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = aLines[i] === bLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (aLines[i] === bLines[j]) {
      out.push({ op: "eq", text: aLines[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ op: "del", text: aLines[i] });
      i++;
    } else {
      out.push({ op: "add", text: bLines[j] });
      j++;
    }
  }
  while (i < n) out.push({ op: "del", text: aLines[i++] });
  while (j < m) out.push({ op: "add", text: bLines[j++] });
  return out;
}

/** Stats for a diff (added/removed line counts). */
export function diffStats(d: DiffLine[]) {
  let added = 0, removed = 0;
  for (const l of d) {
    if (l.op === "add") added++;
    else if (l.op === "del") removed++;
  }
  return { added, removed };
}
