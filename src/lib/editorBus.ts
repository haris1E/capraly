/**
 * Lightweight event bus for cross-component editor commands so panels
 * (BugFinder, ChatPanel, ProjectSidebar) and global keyboard shortcuts can
 * trigger actions inside the editor or other panels without prop-drilling.
 */
type EditorEvent =
  | { type: "apply-fix"; code: string }              // replace editor content with `code` (undoable)
  | { type: "save" }
  | { type: "run-bug-scan" }
  | { type: "focus-chat" }
  | { type: "focus-bugs" }
  | { type: "new-file" };

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
