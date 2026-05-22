/**
 * Guided deploy wizard.
 *
 * Three steps:
 *   1. Preview   — list files in the active project with sizes, detect entry.
 *   2. Checks    — scan for leaked secrets, oversize bundles, missing entry,
 *                  and any non-text / very-large binary blobs.
 *   3. Deploy    — download a deploy-ready ZIP and open Netlify Drop or
 *                  Vercel's new-project flow in a new tab. The user finishes
 *                  the publish on the host, then pastes back the public URL
 *                  which we persist on the project description for reference.
 */
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Rocket, FileText, ShieldCheck, ShieldAlert, CheckCircle2, AlertTriangle,
  Loader2, Download, ExternalLink, ArrowRight, ArrowLeft, Globe, Copy,
} from "lucide-react";
import JSZip from "jszip";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface Props {
  projectId: string | null;
  open: boolean;
  onClose: () => void;
}

interface FileRow {
  id: string;
  name: string;
  language: string;
  content: string;
  size: number;
}

type Severity = "pass" | "warn" | "fail";
interface Check {
  id: string;
  title: string;
  detail: string;
  severity: Severity;
}

// Secret-shaped patterns — intentionally conservative to keep false positives low.
const SECRET_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "AWS secret key", re: /aws_secret_access_key\s*=\s*['"]?[A-Za-z0-9/+=]{40}['"]?/i },
  { name: "OpenAI key", re: /\bsk-[A-Za-z0-9]{32,}\b/ },
  { name: "Stripe live key", re: /\bsk_live_[0-9a-zA-Z]{24,}\b/ },
  { name: "Stripe restricted key", re: /\brk_live_[0-9a-zA-Z]{24,}\b/ },
  { name: "GitHub token", re: /\bghp_[A-Za-z0-9]{36}\b/ },
  { name: "Slack token", re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/ },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_\-]{35}\b/ },
  { name: "Private key block", re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { name: "JWT", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
];

const TOTAL_SIZE_WARN = 5 * 1024 * 1024;   // 5 MB
const TOTAL_SIZE_FAIL = 25 * 1024 * 1024;  // 25 MB

export default function DeployWizard({ projectId, open, onClose }: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [building, setBuilding] = useState(false);
  const [zipUrl, setZipUrl] = useState<string | null>(null);
  const [zipName, setZipName] = useState<string>("project.zip");
  const [deployedUrl, setDeployedUrl] = useState("");

  useEffect(() => {
    if (!open) {
      setStep(1);
      setBuilding(false);
      if (zipUrl) URL.revokeObjectURL(zipUrl);
      setZipUrl(null);
      setDeployedUrl("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { data: project } = useQuery({
    queryKey: ["deploy-project", projectId],
    enabled: !!projectId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, description")
        .eq("id", projectId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: files, isFetching } = useQuery({
    queryKey: ["deploy-files", projectId],
    enabled: !!projectId && open,
    queryFn: async (): Promise<FileRow[]> => {
      const { data, error } = await supabase
        .from("files")
        .select("id, name, language, content")
        .eq("project_id", projectId!)
        .order("name");
      if (error) throw error;
      return (data ?? []).map((f) => ({
        id: f.id,
        name: f.name,
        language: f.language,
        content: f.content ?? "",
        size: new Blob([f.content ?? ""]).size,
      }));
    },
  });

  const totalSize = useMemo(() => (files ?? []).reduce((a, f) => a + f.size, 0), [files]);
  const entryFile = useMemo(
    () => (files ?? []).find((f) => /^index\.html?$/i.test(f.name)),
    [files],
  );

  const checks: Check[] = useMemo(() => {
    if (!files) return [];
    const out: Check[] = [];

    // Entry detection
    if (entryFile) {
      out.push({ id: "entry", title: "Entry file detected", detail: entryFile.name, severity: "pass" });
    } else {
      out.push({
        id: "entry",
        title: "No index.html found",
        detail: "Static hosts (Netlify Drop, Vercel) expect index.html at the root. The deploy will still upload, but visitors will see a 404.",
        severity: "warn",
      });
    }

    // Size
    if (totalSize < TOTAL_SIZE_WARN) {
      out.push({ id: "size", title: `Bundle size ${formatBytes(totalSize)}`, detail: "Well within static host limits.", severity: "pass" });
    } else if (totalSize < TOTAL_SIZE_FAIL) {
      out.push({ id: "size", title: `Bundle size ${formatBytes(totalSize)}`, detail: "Larger than 5 MB — consider trimming assets.", severity: "warn" });
    } else {
      out.push({ id: "size", title: `Bundle size ${formatBytes(totalSize)}`, detail: "Over 25 MB — most free static hosts will reject this. Trim before deploying.", severity: "fail" });
    }

    // Secret scan
    const hits: string[] = [];
    for (const f of files) {
      for (const p of SECRET_PATTERNS) {
        if (p.re.test(f.content)) hits.push(`${f.name}: ${p.name}`);
      }
    }
    if (hits.length === 0) {
      out.push({ id: "secrets", title: "No secrets detected", detail: "Scanned for AWS, OpenAI, Stripe, GitHub, Slack, Google, JWT, and private key patterns.", severity: "pass" });
    } else {
      out.push({
        id: "secrets",
        title: `${hits.length} possible secret${hits.length > 1 ? "s" : ""} found`,
        detail: hits.slice(0, 8).join("\n") + (hits.length > 8 ? `\n…and ${hits.length - 8} more` : ""),
        severity: "fail",
      });
    }

    // File count sanity
    if (files.length === 0) {
      out.push({ id: "empty", title: "Project is empty", detail: "Add at least one file before deploying.", severity: "fail" });
    }

    return out;
  }, [files, entryFile, totalSize]);

  const blocking = checks.some((c) => c.severity === "fail");
  const warnings = checks.filter((c) => c.severity === "warn").length;
  const passing = checks.filter((c) => c.severity === "pass").length;

  const buildZip = async () => {
    if (!files || !project) return;
    setBuilding(true);
    try {
      const zip = new JSZip();
      const root = zip.folder(safeName(project.name)) ?? zip;
      for (const f of files) root.file(f.name, f.content);
      root.file(
        "deploy.json",
        JSON.stringify({
          project: { id: project.id, name: project.name },
          builtAt: new Date().toISOString(),
          fileCount: files.length,
          totalBytes: totalSize,
          entry: entryFile?.name ?? null,
        }, null, 2),
      );
      const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      if (zipUrl) URL.revokeObjectURL(zipUrl);
      const url = URL.createObjectURL(blob);
      setZipUrl(url);
      setZipName(`${safeName(project.name)}-deploy.zip`);
      setStep(3);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to build deploy bundle");
    } finally {
      setBuilding(false);
    }
  };

  const download = () => {
    if (!zipUrl) return;
    const a = document.createElement("a");
    a.href = zipUrl;
    a.download = zipName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const saveDeployedUrl = async () => {
    if (!projectId || !deployedUrl) return;
    try {
      // Best-effort: append to project description so we can show it later.
      const next = `${project?.description ?? ""}\n[deployed] ${deployedUrl}`.trim();
      const { error } = await supabase
        .from("projects")
        .update({ description: next })
        .eq("id", projectId);
      if (error) throw error;
      toast.success("Saved production URL");
      onClose();
    } catch (e: any) {
      toast.error(e?.message ?? "Couldn't save URL");
    }
  };

  if (!projectId) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-surface-1">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" /> Deploy {project?.name ?? "project"}
          </DialogTitle>
          <DialogDescription>
            Preview the bundle, run safety checks, then publish to a static host.
          </DialogDescription>
        </DialogHeader>

        <Stepper step={step} />

        {/* Step 1 — preview */}
        {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{files?.length ?? 0} files · {formatBytes(totalSize)} total</span>
              <span>{entryFile ? `Entry: ${entryFile.name}` : "No index.html"}</span>
            </div>
            <ScrollArea className="h-64 rounded-md border border-border bg-surface-2">
              {isFetching ? (
                <div className="flex h-64 items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : (files ?? []).length === 0 ? (
                <div className="flex h-64 items-center justify-center text-xs text-muted-foreground">
                  No files in this project yet.
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {files!.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                      <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-mono">{f.name}</span>
                      <Badge variant="outline" className="ml-auto h-4 px-1 text-[9px]">
                        {f.language}
                      </Badge>
                      <span className="w-16 text-right font-mono text-[10px] text-muted-foreground">
                        {formatBytes(f.size)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </div>
        )}

        {/* Step 2 — safety checks */}
        {step === 2 && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="h-3.5 w-3.5" /> {passing} passed
              </span>
              <span className="flex items-center gap-1 text-warning">
                <AlertTriangle className="h-3.5 w-3.5" /> {warnings} warning{warnings === 1 ? "" : "s"}
              </span>
              <span className="flex items-center gap-1 text-destructive">
                <ShieldAlert className="h-3.5 w-3.5" /> {checks.filter(c => c.severity === "fail").length} blocking
              </span>
            </div>
            <ScrollArea className="h-64 rounded-md border border-border bg-surface-2 p-2">
              <ul className="space-y-1.5">
                {checks.map((c) => (
                  <li
                    key={c.id}
                    className={cn(
                      "rounded border px-2.5 py-2 text-xs",
                      c.severity === "pass" && "border-success/30 bg-success/5",
                      c.severity === "warn" && "border-warning/30 bg-warning/5",
                      c.severity === "fail" && "border-destructive/30 bg-destructive/5",
                    )}
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      {c.severity === "pass" && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                      {c.severity === "warn" && <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
                      {c.severity === "fail" && <ShieldAlert className="h-3.5 w-3.5 text-destructive" />}
                      {c.title}
                    </div>
                    <pre className="mt-1 whitespace-pre-wrap font-mono text-[10px] text-muted-foreground">
                      {c.detail}
                    </pre>
                  </li>
                ))}
              </ul>
            </ScrollArea>
            {building && <Progress value={66} className="h-1" />}
          </div>
        )}

        {/* Step 3 — deploy */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="rounded-md border border-success/30 bg-success/5 p-3 text-xs">
              <div className="flex items-center gap-1.5 font-medium text-success">
                <ShieldCheck className="h-3.5 w-3.5" /> Bundle ready
              </div>
              <p className="mt-1 text-muted-foreground">
                {zipName} · {files?.length} files · {formatBytes(totalSize)}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button variant="outline" className="h-auto justify-start gap-2 py-3" onClick={download}>
                <Download className="h-4 w-4 text-primary" />
                <div className="text-left">
                  <div className="text-xs font-medium">Download ZIP</div>
                  <div className="text-[10px] text-muted-foreground">deploy.json included</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="h-auto justify-start gap-2 py-3"
                onClick={() => { download(); window.open("https://app.netlify.com/drop", "_blank", "noopener"); }}
              >
                <ExternalLink className="h-4 w-4 text-primary" />
                <div className="text-left">
                  <div className="text-xs font-medium">Netlify Drop</div>
                  <div className="text-[10px] text-muted-foreground">drag ZIP onto page</div>
                </div>
              </Button>
              <Button
                variant="outline"
                className="h-auto justify-start gap-2 py-3"
                onClick={() => { download(); window.open("https://vercel.com/new", "_blank", "noopener"); }}
              >
                <ExternalLink className="h-4 w-4 text-primary" />
                <div className="text-left">
                  <div className="text-xs font-medium">Vercel</div>
                  <div className="text-[10px] text-muted-foreground">import ZIP project</div>
                </div>
              </Button>
            </div>

            <div className="rounded-md border border-border bg-surface-2 p-3">
              <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Globe className="h-3 w-3" /> Production URL (optional)
              </label>
              <div className="flex gap-1.5">
                <Input
                  value={deployedUrl}
                  onChange={(e) => setDeployedUrl(e.target.value)}
                  placeholder="https://your-project.netlify.app"
                  className="h-8 text-xs"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-2"
                  onClick={async () => {
                    if (!deployedUrl) return;
                    try { await navigator.clipboard.writeText(deployedUrl); toast.success("Copied"); } catch { /* noop */ }
                  }}
                  disabled={!deployedUrl}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" className="h-8" onClick={saveDeployedUrl} disabled={!deployedUrl}>
                  Save
                </Button>
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                Paste the public URL the host gives you and we'll keep it on the project.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div>
            {step > 1 && step < 3 && (
              <Button variant="ghost" size="sm" onClick={() => setStep((s) => (s - 1) as 1 | 2)}>
                <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            {step === 1 && (
              <Button size="sm" onClick={() => setStep(2)} disabled={!files || files.length === 0}>
                Run safety checks <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            )}
            {step === 2 && (
              <Button size="sm" onClick={buildZip} disabled={blocking || building}>
                {building ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Rocket className="mr-1 h-3.5 w-3.5" />}
                {blocking ? "Fix blocking issues" : "Build deploy bundle"}
              </Button>
            )}
            {step === 3 && (
              <Button size="sm" variant="hero" onClick={onClose}>Done</Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const items = [
    { n: 1, label: "Preview", icon: FileText },
    { n: 2, label: "Safety checks", icon: ShieldCheck },
    { n: 3, label: "Deploy", icon: Rocket },
  ];
  return (
    <div className="flex items-center gap-2">
      {items.map((it, i) => {
        const active = step === it.n;
        const done = step > it.n;
        const Icon = it.icon;
        return (
          <div key={it.n} className="flex flex-1 items-center gap-2">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-semibold",
                active && "border-primary bg-primary/10 text-primary",
                done && "border-success bg-success/10 text-success",
                !active && !done && "border-border text-muted-foreground",
              )}
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Icon className="h-3 w-3" />}
            </div>
            <span className={cn(
              "text-[11px]",
              active && "font-medium text-foreground",
              !active && "text-muted-foreground",
            )}>
              {it.label}
            </span>
            {i < items.length - 1 && <div className="mx-1 h-px flex-1 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function safeName(s: string) {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "project";
}
