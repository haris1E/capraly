/**
 * Lightweight event bus for cross-component editor commands so panels
 * (BugFinder, ChatPanel, ProjectSidebar, Composer, Terminal, TopBar) and
 * global keyboard shortcuts can trigger actions inside the editor or
 * other panels without prop-drilling.
 */
type EditorEvent =
  | { type: "apply-fix"; code: string }                // replace entire editor content (undoable)
  | { type: "apply-selection-edit"; startLine: number; endLine: number; newText: string } // replace a specific range
  | { type: "save" }
  | { type: "run-bug-scan" }
  | { type: "focus-chat" }
  | { type: "focus-bugs" }
  | { type: "focus-composer" }
  | { type: "new-file" }
  | { type: "open-cmdk" }                              // open inline-edit popup
  | { type: "run-active-file" }                        // run current file in terminal
  | { type: "clear-terminal" }
  | { type: "retry"; endpoint: string };               // retry a failed AI request

type Handler = (e: EditorEvent) => void;

const handlers = new Set<Handler>();

export const editorBus = {
  emit(e: EditorEvent) {
    handlers.forEach((h) => h(e));
  },
  on(h: Handler) {
    handlers.add(h);
    return () => { handlers.delete(h); };
  },
};
