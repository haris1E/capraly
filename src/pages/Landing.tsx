import { Link } from "react-router-dom";
import { Sparkles, Bug, MessageSquare, Code2, Zap, Shield, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import Seo from "@/components/Seo";

const softwareLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Capraly",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  url: "https://capraly.lovable.app",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const features = [
  { icon: Bug, title: "AI Bug Finder", desc: "Catch bugs, security flaws, and perf traps before they ship — with line-level fixes.", grad: "bg-gradient-ai" },
  { icon: MessageSquare, title: "Pair-Programming Chat", desc: "Ask anything about your open file. Refactor, explain, optimize — instantly.", grad: "bg-gradient-primary" },
  { icon: Code2, title: "Real Code Editor", desc: "Powered by Monaco — the engine behind VS Code. Syntax for 18+ languages.", grad: "bg-gradient-primary" },
  { icon: Shield, title: "Private by Default", desc: "Your projects, your files. Row-level security on every read and write.", grad: "bg-gradient-ai" },
];

const languages = ["TypeScript", "Python", "Rust", "Go", "Java", "C++", "Ruby", "PHP", "SQL"];

export default function Landing() {
  const { user } = useAuth();
  const ctaTo = user ? "/editor" : "/auth";

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Background glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] bg-gradient-glow" />

      {/* Nav */}
      <header className="flex h-16 items-center justify-between px-6 lg:px-12">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">Capraly</span>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <Button asChild variant="hero" size="sm">
              <Link to="/editor">Open editor <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/auth">Sign in</Link>
              </Button>
              <Button asChild variant="hero" size="sm">
                <Link to="/auth">Get started</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 pb-20 pt-16 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <Zap className="h-3 w-3 text-primary" />
          Powered by Gemini & GPT-5
        </div>
        <h1 className="font-display text-5xl font-bold leading-tight tracking-tight md:text-7xl">
          Write code.{" "}
          <span className="text-gradient-primary">Find bugs.</span>
          <br />
          <span className="text-gradient-ai">Ship faster.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          A modern, AI-powered code editor that reviews your code line-by-line,
          flags real issues, and suggests fixes — right in the browser.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild variant="hero" size="lg" className="h-12 px-8">
            <Link to={ctaTo}>
              {user ? "Open editor" : "Start coding free"} <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
          <Button asChild variant="subtle" size="lg" className="h-12 px-8">
            <a href="#features">See features</a>
          </Button>
        </div>

        {/* Languages strip */}
        <div className="mx-auto mt-14 flex max-w-3xl flex-wrap items-center justify-center gap-2">
          {languages.map((l) => (
            <span key={l} className="rounded-md border border-border bg-surface-2/60 px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
              {l}
            </span>
          ))}
        </div>
      </section>

      {/* Editor preview mock */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-elevated">
          <div className="flex items-center gap-2 border-b border-border bg-surface-1 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-warning/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-success/70" />
            <span className="ml-3 font-mono text-[11px] text-muted-foreground">app.ts — Capraly</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_320px]">
            <pre className="overflow-x-auto bg-[#0d1219] p-6 font-mono text-[13px] leading-relaxed">
              <code>
                <span className="text-muted-foreground">// async/await with retry</span>{"\n"}
                <span style={{ color: "#b388ff" }}>async function</span>{" "}
                <span style={{ color: "#5fd4ff" }}>fetchUser</span>(id: <span style={{ color: "#5fd4ff" }}>string</span>) {"{\n"}
                {"  "}<span style={{ color: "#b388ff" }}>const</span> res = <span style={{ color: "#b388ff" }}>await</span> fetch(<span style={{ color: "#7ee787" }}>`/api/users/${"${"}id{"}"}`</span>);{"\n"}
                {"  "}<span style={{ color: "#b388ff" }}>if</span> (!res.ok) <span style={{ color: "#b388ff" }}>throw new</span>{" "}
                <span style={{ color: "#5fd4ff" }}>Error</span>(<span style={{ color: "#7ee787" }}>"failed"</span>);{"\n"}
                {"  "}<span style={{ color: "#b388ff" }}>return</span> res.json();{"\n"}
                {"}"}
              </code>
            </pre>
            <div className="border-t border-border bg-surface-1 p-4 md:border-l md:border-t-0">
              <div className="mb-2 flex items-center gap-1.5">
                <Bug className="h-3.5 w-3.5 text-secondary-glow" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-secondary-glow">Bug Finder</span>
              </div>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-warning">⚠ medium · bug (line 3)</span>
                <br />Missing input validation; <code className="text-primary">id</code> may inject path segments.
              </p>
              <div className="mt-3 rounded-md bg-surface-2 p-2 font-mono text-[11px] text-success">
                + if (!/^\d+$/.test(id)) throw new Error("invalid id");
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-24">
        <h2 className="mb-12 text-center font-display text-3xl font-bold md:text-4xl">
          Everything you need, nothing you don't.
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          {features.map((f) => (
            <div key={f.title} className="group rounded-xl border border-border bg-surface-2/60 p-6 backdrop-blur transition-base hover:border-primary/40 hover:bg-surface-2">
              <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg ${f.grad} shadow-glow`}>
                <f.icon className="h-5 w-5 text-primary-foreground" />
              </div>
              <h3 className="font-display text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-3xl px-6 pb-24 text-center">
        <div className="rounded-2xl border border-border bg-gradient-surface p-12 shadow-elevated">
          <h2 className="font-display text-3xl font-bold md:text-4xl">Ready to clean up that codebase?</h2>
          <p className="mt-3 text-muted-foreground">Sign in with Google or email — your first project is on us.</p>
          <Button asChild variant="hero" size="lg" className="mt-6 h-12 px-8">
            <Link to={ctaTo}>{user ? "Back to editor" : "Start free"} <ArrowRight className="h-5 w-5" /></Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
          <span>·</span>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
        </div>
        <p className="mt-2 text-muted-foreground/70">© {new Date().getFullYear()} Capraly · Built with Lovable Cloud · React · Monaco</p>
      </footer>
    </div>
  );
}
