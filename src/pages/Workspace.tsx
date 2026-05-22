import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bug, MessageSquare, Loader2, Wand2 } from "lucide-react";
import type { editor as MEditor } from "monaco-editor";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { editorBus } from "@/lib/editorBus";
import ProjectSidebar from "@/components/editor/ProjectSidebar";
import CodeEditor, { type OpenFile, type SelectionInfo } from "@/components/editor/CodeEditor";
import BugFinder from "@/components/editor/BugFinder";
import ChatPanel from "@/components/editor/ChatPanel";
import Composer from "@/components/editor/Composer";
import TerminalPanel from "@/components/editor/TerminalPanel";
import TopBar from "@/components/editor/TopBar";
import InlineEditPopup from "@/components/editor/InlineEditPopup";
import PresenceCursors from "@/components/editor/PresenceCursors";
import AiErrorPanel from "@/components/editor/AiErrorPanel";
import DeployWizard from "@/components/editor/DeployWizard";

interface FileMeta { id: string; project_id: string; name: string; language: string }

export default function Workspace() {
  const { user } = useAuth();
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [liveContent, setLiveContent] = useState("");
  const [tab, setTab] = useState("bugs");
  const [selection, setSelection] = useState<SelectionInfo | null>(null);
  const [editor, setEditor] = useState<MEditor.IStandaloneCodeEditor | null>(null);
  const [cmdkOpen, setCmdkOpen] = useState(false);

  useKeyboardShortcuts();

  // React to focus / cmdk events from shortcuts + top bar
  useEffect(() => {
    return editorBus.on((e) => {
      if (e.type === "focus-bugs") setTab("bugs");
      else if (e.type === "focus-chat") {
        setTab("chat");
        setTimeout(() => {
          document.querySelector<HTMLTextAreaElement>("textarea[data-chat-input]")?.focus();
        }, 50);
      } else if (e.type === "focus-composer") {
        setTab("composer");
      } else if (e.type === "open-cmdk") {
        setCmdkOpen(true);
      }
    });
  }, []);

  // Load full file content when active changes
  const { data: openFile, isFetching } = useQuery({
    queryKey: ["file", activeFileId],
    enabled: !!activeFileId,
    queryFn: async (): Promise<OpenFile | null> => {
      if (!activeFileId) return null;
      const { data, error } = await supabase
        .from("files")
        .select("id, name, language, content, project_id")
        .eq("id", activeFileId)
        .single();
      if (error) throw error;
      setLiveContent(data.content ?? "");
      setActiveProjectId(data.project_id);
      return {
        id: data.id, name: data.name, language: data.language, content: data.content,
      };
    },
  });

  const liveFile: OpenFile | null = openFile
    ? { ...openFile, content: liveContent }
    : null;

  if (!user) return null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <ProjectSidebar
        user={user}
        activeFileId={activeFileId}
        onOpenFile={(f: FileMeta) => { setActiveFileId(f.id); setActiveProjectId(f.project_id); }}
      />

      <div className="flex flex-1 flex-col">
        <TopBar fileName={openFile?.name} />

        <ResizablePanelGroup direction="horizontal" className="flex-1">
          <ResizablePanel defaultSize={62} minSize={35}>
            <ResizablePanelGroup direction="vertical">
              <ResizablePanel defaultSize={70} minSize={25}>
                <div className="relative h-full">
                  {isFetching && !openFile ? (
                    <div className="flex h-full items-center justify-center bg-surface-2">
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                  ) : (
                    <CodeEditor
                      file={openFile ?? null}
                      onContentChange={setLiveContent}
                      onSelectionChange={setSelection}
                      onEditorReady={setEditor}
                    />
                  )}
                  <PresenceCursors user={user} fileId={activeFileId} editor={editor} />
                </div>
              </ResizablePanel>
              <ResizableHandle className="bg-border hover:bg-primary/30 transition-base" />
              <ResizablePanel defaultSize={30} minSize={12}>
                <TerminalPanel file={liveFile} />
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>

          <ResizableHandle className="bg-border hover:bg-primary/30 transition-base" />

          <ResizablePanel defaultSize={38} minSize={25}>
            <Tabs value={tab} onValueChange={setTab} className="flex h-full flex-col">
              <TabsList className="h-9 w-full justify-start rounded-none border-b border-border bg-surface-1 p-0">
                <TabsTrigger
                  value="bugs"
                  className="h-9 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
                >
                  <Bug className="mr-1.5 h-3.5 w-3.5" /> Bugs <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">⌘L</span>
                </TabsTrigger>
                <TabsTrigger
                  value="chat"
                  className="h-9 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
                >
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Chat <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">⌘J</span>
                </TabsTrigger>
                <TabsTrigger
                  value="composer"
                  className="h-9 rounded-none border-b-2 border-transparent px-3 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
                >
                  <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Composer <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">⌘I</span>
                </TabsTrigger>
              </TabsList>
              <TabsContent value="bugs" className="m-0 flex-1 overflow-hidden">
                <BugFinder file={liveFile} />
              </TabsContent>
              <TabsContent value="chat" className="m-0 flex-1 overflow-hidden">
                <ChatPanel file={liveFile} />
              </TabsContent>
              <TabsContent value="composer" className="m-0 flex-1 overflow-hidden">
                <Composer projectId={activeProjectId} ownerId={user.id} />
              </TabsContent>
            </Tabs>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <InlineEditPopup
        file={liveFile}
        selection={selection}
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
      />

      <AiErrorPanel />
    </div>
  );
}
