import { useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Save, Check } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { defineCapralyTheme } from "@/lib/monacoTheme";
import { detectLanguage } from "@/lib/languages";
import { Badge } from "@/components/ui/badge";
import { editorBus } from "@/lib/editorBus";

export interface OpenFile {
  id: string;
  name: string;
  language: string;
  content: string;
}

export interface SelectionInfo {
  text: string;
  startLine: number;
  endLine: number;
}

interface Props {
  file: OpenFile | null;
  onContentChange: (content: string) => void;
  onSelectionChange?: (sel: SelectionInfo | null) => void;
  onEditorReady?: (editor: Parameters<OnMount>[0] | null) => void;
}

/**
 * Monaco-backed editor with debounced autosave + a global event bus hook
 * so external panels (Bug Finder "Apply fix", CMD+K inline-edit popup,
 * keyboard shortcuts) can mutate buffer content via undoable Monaco edits.
 */
export default function CodeEditor({ file, onContentChange, onSelectionChange, onEditorReady }: Props) {
  const [localValue, setLocalValue] = useState(file?.content ?? "");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dirtyRef = useRef(false);
  const debounceRef = useRef<number | null>(null);
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

  // Sync incoming file
  useEffect(() => {
    setLocalValue(file?.content ?? "");
    dirtyRef.current = false;
    setSavedAt(null);
  }, [file?.id]);

  const saveMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!file) return;
      const { error } = await supabase
        .from("files")
        .update({ content, language: file.language })
        .eq("id", file.id);
      if (error) throw error;
    },
    onSuccess: () => {
      dirtyRef.current = false;
      setSavedAt(Date.now());
    },
  });

  // Debounced autosave
  useEffect(() => {
    if (!file) return;
    if (!dirtyRef.current) return;
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      saveMutation.mutate(localValue);
    }, 800);
    return () => { if (debounceRef.current) window.clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localValue, file?.id]);

  // Listen for "apply-fix" / "apply-selection-edit" / "save" commands
  useEffect(() => {
    return editorBus.on((e) => {
      const editor = editorRef.current;
      if (!file) return;

      if (e.type === "apply-fix") {
        if (!editor) return toast.error("Open a file first");
        const model = editor.getModel();
        if (!model) return;
        const range = model.getFullModelRange();
        editor.pushUndoStop();
        editor.executeEdits("apply-fix", [{ range, text: e.code, forceMoveMarkers: true }]);
        editor.pushUndoStop();
        toast.success("Fix applied — press ⌘Z / Ctrl+Z to undo");
      } else if (e.type === "apply-selection-edit") {
        if (!editor) return toast.error("Open a file first");
        const model = editor.getModel();
        if (!model) return;
        const lastCol = model.getLineMaxColumn(e.endLine);
        editor.pushUndoStop();
        editor.executeEdits("inline-edit", [
          {
            range: {
              startLineNumber: e.startLine,
              startColumn: 1,
              endLineNumber: e.endLine,
              endColumn: lastCol,
            },
            text: e.newText,
            forceMoveMarkers: true,
          },
        ]);
        editor.pushUndoStop();
      } else if (e.type === "save") {
        saveMutation.mutate(localValue);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file?.id, localValue]);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    onEditorReady?.(editor);
    defineCapralyTheme(monaco);
    monaco.editor.setTheme("capraly-dark");
    editor.updateOptions({
      fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      fontSize: 13,
      fontLigatures: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      padding: { top: 16, bottom: 16 },
      renderLineHighlight: "all",
      bracketPairColorization: { enabled: true },
    });

    // Monaco-local Cmd/Ctrl+S → save (don't print)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      editorBus.emit({ type: "save" });
    });
    // Monaco-local Cmd/Ctrl+K → open inline edit popup
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
      editorBus.emit({ type: "open-cmdk" });
    });

    // Track selection → propagate up so the popup can grab the latest
    editor.onDidChangeCursorSelection(() => {
      if (!onSelectionChange) return;
      const sel = editor.getSelection();
      const model = editor.getModel();
      if (!sel || !model || sel.isEmpty()) {
        onSelectionChange(null);
        return;
      }
      const text = model.getValueInRange(sel);
      onSelectionChange({
        text,
        startLine: sel.startLineNumber,
        endLine: sel.endLineNumber,
      });
    });
  };

  // Cleanup editor ref on unmount so Workspace doesn't hold a stale handle
  useEffect(() => () => onEditorReady?.(null), [onEditorReady]);

  if (!file) {
    return (
      <div className="flex flex-1 items-center justify-center bg-surface-2">
        <div className="text-center">
          <p className="font-display text-2xl font-semibold text-muted-foreground">No file open</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Pick a file from the sidebar or create a new one to start editing.
          </p>
          <p className="mt-4 font-mono text-[11px] text-muted-foreground/70">
            ⌘N new · ⌘S save · ⌘K edit · ⌘⇧B scan · ⌘L bugs · ⌘J chat · ⌘↵ run
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-surface-2">
      <div className="flex h-10 items-center gap-2 border-b border-border bg-surface-1 px-3">
        <div className="flex items-center gap-2 rounded-t-md border-x border-t border-border bg-surface-2 px-3 py-1.5">
          <span className="font-mono text-xs">{file.name}</span>
          {dirtyRef.current && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
        </div>
        <Badge variant="outline" className="ml-auto font-mono text-[10px]">
          {file.language}
        </Badge>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {saveMutation.isPending ? (
            <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>
          ) : savedAt ? (
            <><Check className="h-3 w-3 text-success" /> Saved</>
          ) : (
            <><Save className="h-3 w-3" /> Auto-save on</>
          )}
        </div>
      </div>

      <div className="relative flex-1">
        <Editor
          height="100%"
          path={file.name}
          language={detectLanguage(file.name)}
          value={localValue}
          theme="capraly-dark"
          onMount={handleMount}
          onChange={(v) => {
            const next = v ?? "";
            setLocalValue(next);
            dirtyRef.current = true;
            onContentChange(next);
          }}
          loading={
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          }
        />
      </div>
    </div>
  );
}
