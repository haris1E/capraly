/**
 * Realtime presence cursors — broadcasts the local user's cursor line/col
 * for the active file via a Supabase Realtime channel scoped per file,
 * and overlays remote users' name + colored caret on the editor surface.
 *
 * This is a presence overlay only (no Operational Transform). Multiple users
 * editing the same file may see drift; for MVP we just visualize who's there.
 */
import { useEffect, useRef, useState } from "react";
import type { editor as MEditor } from "monaco-editor";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface RemoteCursor {
  user_id: string;
  name: string;
  color: string;
  line: number;
  column: number;
}

interface Props {
  user: User;
  fileId: string | null;
  editor: MEditor.IStandaloneCodeEditor | null;
}

const COLORS = ["#5fd4ff", "#b388ff", "#f5a97f", "#7ee787", "#ff7b7b", "#ffd866"];

function colorFor(uid: string) {
  let h = 0;
  for (let i = 0; i < uid.length; i++) h = (h * 31 + uid.charCodeAt(i)) & 0xffff;
  return COLORS[h % COLORS.length];
}

export default function PresenceCursors({ user, fileId, editor }: Props) {
  const [remote, setRemote] = useState<RemoteCursor[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const decorationsRef = useRef<MEditor.IEditorDecorationsCollection | null>(null);
  const styleId = "capraly-presence-styles";

  // Inject keyframes + per-color caret styles once
  useEffect(() => {
    if (document.getElementById(styleId)) return;
    const el = document.createElement("style");
    el.id = styleId;
    el.textContent = COLORS
      .map(
        (c, i) => `
.capraly-caret-${i} { border-left: 2px solid ${c}; margin-left: -1px; }
.capraly-label-${i}::after {
  content: attr(data-name);
  position: absolute;
  background: ${c};
  color: #0d1219;
  font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  padding: 1px 4px;
  border-radius: 3px;
  transform: translateY(-100%);
  white-space: nowrap;
  pointer-events: none;
}`,
      )
      .join("\n");
    document.head.appendChild(el);
  }, []);

  // Channel lifecycle, scoped per file
  useEffect(() => {
    if (!fileId) return;
    const myColor = colorFor(user.id);
    const myName = user.email?.split("@")[0] ?? "anon";

    const channel = supabase.channel(`presence:file:${fileId}`, {
      config: { presence: { key: user.id } },
    });
    channelRef.current = channel;

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, RemoteCursor[]>;
        const list: RemoteCursor[] = [];
        for (const uid of Object.keys(state)) {
          if (uid === user.id) continue;
          const meta = state[uid][0];
          if (meta) list.push(meta);
        }
        setRemote(list);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            name: myName,
            color: myColor,
            line: 1,
            column: 1,
          } satisfies RemoteCursor);
        }
      });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
      setRemote([]);
    };
  }, [fileId, user.id, user.email]);

  // Track local cursor → broadcast position (throttled)
  useEffect(() => {
    if (!editor || !fileId) return;
    const myColor = colorFor(user.id);
    const myName = user.email?.split("@")[0] ?? "anon";

    let timer: number | null = null;
    const disp = editor.onDidChangeCursorPosition((e) => {
      if (timer) return;
      timer = window.setTimeout(() => {
        timer = null;
        channelRef.current?.track({
          user_id: user.id,
          name: myName,
          color: myColor,
          line: e.position.lineNumber,
          column: e.position.column,
        } satisfies RemoteCursor);
      }, 120);
    });
    return () => {
      disp.dispose();
      if (timer) window.clearTimeout(timer);
    };
  }, [editor, fileId, user.id, user.email]);

  // Render remote cursors as Monaco decorations
  useEffect(() => {
    if (!editor) return;
    if (!decorationsRef.current) {
      decorationsRef.current = editor.createDecorationsCollection([]);
    }
    const newDecs: MEditor.IModelDeltaDecoration[] = remote.map((r) => {
      const idx = COLORS.indexOf(r.color);
      const i = idx >= 0 ? idx : 0;
      return {
        range: {
          startLineNumber: r.line,
          startColumn: r.column,
          endLineNumber: r.line,
          endColumn: r.column,
        },
        options: {
          className: `capraly-caret-${i}`,
          afterContentClassName: `capraly-label-${i}`,
          after: { content: " ", inlineClassName: `capraly-label-${i}` },
          hoverMessage: { value: `**${r.name}** is here` },
          stickiness: 1,
        },
      };
    });
    decorationsRef.current.set(newDecs);
  }, [remote, editor]);

  // Tiny avatar stack for visible presence
  if (remote.length === 0) return null;
  return (
    <div className="pointer-events-none absolute right-3 top-1.5 z-10 flex items-center gap-1">
      {remote.slice(0, 4).map((r) => (
        <div
          key={r.user_id}
          title={`${r.name} (line ${r.line})`}
          className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-[#0d1219] shadow"
          style={{ background: r.color }}
        >
          {r.name[0]?.toUpperCase() ?? "?"}
        </div>
      ))}
      {remote.length > 4 && (
        <div className="flex h-5 items-center rounded-full bg-surface-3 px-1.5 text-[9px] font-mono text-muted-foreground">
          +{remote.length - 4}
        </div>
      )}
    </div>
  );
}
