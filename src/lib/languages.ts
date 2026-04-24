/**
 * Map common file extensions to Monaco language IDs.
 */
export function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
    ts: "typescript", tsx: "typescript",
    py: "python",
    rb: "ruby",
    go: "go",
    rs: "rust",
    java: "java",
    c: "c", h: "c",
    cpp: "cpp", cc: "cpp", hpp: "cpp",
    cs: "csharp",
    php: "php",
    html: "html", htm: "html",
    css: "css", scss: "scss",
    json: "json",
    md: "markdown",
    yml: "yaml", yaml: "yaml",
    sh: "shell", bash: "shell",
    sql: "sql",
    xml: "xml",
  };
  return map[ext] ?? "plaintext";
}

export const SUPPORTED_LANGUAGES = [
  "javascript", "typescript", "python", "ruby", "go", "rust",
  "java", "c", "cpp", "csharp", "php", "html", "css", "json",
  "markdown", "yaml", "shell", "sql", "xml", "plaintext",
];
