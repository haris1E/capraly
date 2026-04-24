import { useEffect } from "react";
import { editorBus } from "@/lib/editorBus";

/**
 * Global IDE-style keyboard shortcuts.
 *
 *  ⌘/Ctrl + N           → new file (handled by the sidebar)
 *  ⌘/Ctrl + S           → save active file
 *  ⌘/Ctrl + Shift + B   → run bug scan
 *  ⌘/Ctrl + L           → focus the Bug Finder tab
 *  ⌘/Ctrl + J           → focus the Chat tab + input
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();

      // Ignore when user is typing in our chat textarea — they may want native shortcuts.
      // (We still allow Cmd+S which never types a character.)
      if (key === "n" && !e.shiftKey) {
        e.preventDefault();
        editorBus.emit({ type: "new-file" });
      } else if (key === "s" && !e.shiftKey) {
        e.preventDefault();
        editorBus.emit({ type: "save" });
      } else if (key === "b" && e.shiftKey) {
        e.preventDefault();
        editorBus.emit({ type: "run-bug-scan" });
      } else if (key === "l" && !e.shiftKey) {
        e.preventDefault();
        editorBus.emit({ type: "focus-bugs" });
      } else if (key === "j" && !e.shiftKey) {
        e.preventDefault();
        editorBus.emit({ type: "focus-chat" });
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
