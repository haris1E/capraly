import { useEffect, useRef, useState } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Save, Check } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { defineCapralyTheme } from "@/lib/monacoTheme";
import { detectLanguage } from "@/lib/languages";
import { Badge } from "@/components/ui/badge";

export interface OpenFile {
  id: string;
  name: string;
  language: string;
  content: string;
}

interface Props {
  file: OpenFile | null;
  onContentChange: (content: string) => void;
}

export default function CodeEditor({ file, onContentChange }: Props) {
  const [localValue, setLocalValue] = useState(file?.content ?? "");
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const dirtyRef = useRef(false);
  const debounceRef = useRef<number | null>(null);

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

  const handleMount: OnMount = (editor, monaco) => {
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
  };

  if (!file) {
    return (
      <div className="flex flex-1 items-center justify-center bg-surface-2">
        <div className="text-center">
          <p className="font-display text-2xl font-semibold text-muted-foreground">No file open</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Pick a file from the sidebar or create a new one to start editing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col bg-surface-2">
      {/* File header / tab */}
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

      <div className="flex-1">
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
