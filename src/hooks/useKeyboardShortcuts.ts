import { useEffect } from "react";
import { editorBus } from "@/lib/editorBus";

/**
 * Global IDE-style keyboard shortcuts.
 *
 *  ⌘/Ctrl + N           → new file (handled by the sidebar)
 *  ⌘/Ctrl + S           → save active file
 *  ⌘/Ctrl + K           → open inline-edit popup with current selection
 *  ⌘/Ctrl + Shift + B   → run bug scan
 *  ⌘/Ctrl + L           → focus the Bug Finder tab
 *  ⌘/Ctrl + J           → focus the Chat tab + input
 *  ⌘/Ctrl + I           → focus the Composer tab
 *  ⌘/Ctrl + Enter       → run active file in terminal
 *
 * Notes:
 * - Monaco also wires ⌘S and ⌘K locally so they fire even when the editor
 *   has focus (browser may otherwise eat them).
 */
export function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();

      if (key === "n" && !e.shiftKey) {
        e.preventDefault();
        editorBus.emit({ type: "new-file" });
      } else if (key === "s" && !e.shiftKey) {
        e.preventDefault();
        editorBus.emit({ type: "save" });
      } else if (key === "k" && !e.shiftKey) {
        e.preventDefault();
        editorBus.emit({ type: "open-cmdk" });
      } else if (key === "b" && e.shiftKey) {
        e.preventDefault();
        editorBus.emit({ type: "run-bug-scan" });
      } else if (key === "l" && !e.shiftKey) {
        e.preventDefault();
        editorBus.emit({ type: "focus-bugs" });
      } else if (key === "j" && !e.shiftKey) {
        e.preventDefault();
        editorBus.emit({ type: "focus-chat" });
      } else if (key === "i" && !e.shiftKey) {
        e.preventDefault();
        editorBus.emit({ type: "focus-composer" });
      } else if (key === "enter") {
        e.preventDefault();
        editorBus.emit({ type: "run-active-file" });
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
