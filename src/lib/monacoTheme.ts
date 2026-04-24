import type * as Monaco from "monaco-editor";

/**
 * Apply a custom dark IDE theme to Monaco that matches our design tokens.
 * Called once when the editor mounts.
 */
export function defineCapralyTheme(monaco: typeof Monaco) {
  monaco.editor.defineTheme("capraly-dark", {
    base: "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: "6b7a8f", fontStyle: "italic" },
      { token: "keyword", foreground: "b388ff" },
      { token: "string", foreground: "7ee787" },
      { token: "number", foreground: "f5a97f" },
      { token: "type", foreground: "5fd4ff" },
      { token: "function", foreground: "5fd4ff" },
      { token: "variable", foreground: "e6edf3" },
      { token: "delimiter", foreground: "8b949e" },
      { token: "tag", foreground: "b388ff" },
      { token: "attribute.name", foreground: "5fd4ff" },
      { token: "attribute.value", foreground: "7ee787" },
    ],
    colors: {
      "editor.background": "#0d1219",
      "editor.foreground": "#e6edf3",
      "editorLineNumber.foreground": "#3a4453",
      "editorLineNumber.activeForeground": "#5fd4ff",
      "editorCursor.foreground": "#5fd4ff",
      "editor.selectionBackground": "#1f6feb44",
      "editor.lineHighlightBackground": "#161c25",
      "editorGutter.background": "#0d1219",
      "editorWidget.background": "#161c25",
      "editorWidget.border": "#1f2937",
      "editorSuggestWidget.background": "#161c25",
      "editorSuggestWidget.border": "#1f2937",
      "editorSuggestWidget.selectedBackground": "#1f6feb44",
      "scrollbarSlider.background": "#1f293788",
      "scrollbarSlider.hoverBackground": "#374151aa",
      "scrollbarSlider.activeBackground": "#5fd4ff66",
    },
  });
}
