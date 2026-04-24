import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bug, MessageSquare, Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import ProjectSidebar from "@/components/editor/ProjectSidebar";
import CodeEditor, { type OpenFile } from "@/components/editor/CodeEditor";
import BugFinder from "@/components/editor/BugFinder";
import ChatPanel from "@/components/editor/ChatPanel";

interface FileMeta { id: string; project_id: string; name: string; language: string }

export default function Workspace() {
  const { user } = useAuth();
  const [activeFileId, setActiveFileId] = useState<string | null>(null);
  const [liveContent, setLiveContent] = useState("");

  // Load full file content when active changes
  const { data: openFile, isFetching } = useQuery({
    queryKey: ["file", activeFileId],
    enabled: !!activeFileId,
    queryFn: async (): Promise<OpenFile | null> => {
      if (!activeFileId) return null;
      const { data, error } = await supabase
        .from("files")
        .select("id, name, language, content")
        .eq("id", activeFileId)
        .single();
      if (error) throw error;
      setLiveContent(data.content ?? "");
      return data as OpenFile;
    },
  });

  // Compose a "live" file object that always reflects the editor's current text
  const liveFile: OpenFile | null = openFile
    ? { ...openFile, content: liveContent }
    : null;

  if (!user) return null;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <ProjectSidebar
        user={user}
        activeFileId={activeFileId}
        onOpenFile={(f: FileMeta) => setActiveFileId(f.id)}
      />

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        <ResizablePanel defaultSize={62} minSize={35}>
          {isFetching && !openFile ? (
            <div className="flex h-full items-center justify-center bg-surface-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            <CodeEditor file={openFile ?? null} onContentChange={setLiveContent} />
          )}
        </ResizablePanel>
        <ResizableHandle className="bg-border hover:bg-primary/30 transition-base" />
        <ResizablePanel defaultSize={38} minSize={25}>
          <Tabs defaultValue="bugs" className="flex h-full flex-col">
            <TabsList className="h-9 w-full justify-start rounded-none border-b border-border bg-surface-1 p-0">
              <TabsTrigger
                value="bugs"
                className="h-9 rounded-none border-b-2 border-transparent px-4 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
              >
                <Bug className="mr-1.5 h-3.5 w-3.5" /> Bug Finder
              </TabsTrigger>
              <TabsTrigger
                value="chat"
                className="h-9 rounded-none border-b-2 border-transparent px-4 text-xs data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary"
              >
                <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Chat
              </TabsTrigger>
            </TabsList>
            <TabsContent value="bugs" className="m-0 flex-1 overflow-hidden">
              <BugFinder file={liveFile} />
            </TabsContent>
            <TabsContent value="chat" className="m-0 flex-1 overflow-hidden">
              <ChatPanel file={liveFile} />
            </TabsContent>
          </Tabs>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
