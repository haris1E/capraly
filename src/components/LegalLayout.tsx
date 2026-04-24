import { Link } from "react-router-dom";
import { Sparkles, ArrowLeft } from "lucide-react";

interface Props {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Shared layout for static legal / marketing pages (Privacy, Terms, Pricing).
 * Keeps the brand, back-to-home link, and footer consistent.
 */
export default function LegalLayout({ title, subtitle, children }: Props) {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[400px] bg-gradient-glow" />

      <header className="flex h-16 items-center justify-between px-6 lg:px-12">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary shadow-glow">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight">Capraly</span>
        </Link>
        <Link to="/" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to home
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">{title}</h1>
        {subtitle && <p className="mt-3 text-muted-foreground">{subtitle}</p>}
        <div className="prose prose-invert prose-sm mt-10 max-w-none prose-headings:font-display prose-headings:tracking-tight prose-headings:text-foreground prose-h2:mt-10 prose-h2:text-2xl prose-h3:text-lg prose-p:text-muted-foreground prose-li:text-muted-foreground prose-strong:text-foreground prose-a:text-primary">
          {children}
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span>·</span>
          <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
          <span>·</span>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
        </div>
        <p className="mt-2 text-muted-foreground/70">© {new Date().getFullYear()} Capraly · Built with Lovable Cloud</p>
      </footer>
    </div>
  );
}
