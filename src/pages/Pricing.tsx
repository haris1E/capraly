import { Link } from "react-router-dom";
import { Check, Sparkles, Zap, Crown, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Plan {
  name: string;
  price: string;
  period?: string;
  tagline: string;
  highlight?: boolean;
  icon: typeof Sparkles;
  cta: string;
  ctaTo: string;
  features: string[];
}

const plans: Plan[] = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    tagline: "Hack on side projects with AI assistance.",
    icon: Sparkles,
    cta: "Start free",
    ctaTo: "/auth",
    features: [
      "Up to 3 projects",
      "Up to 25 files per project",
      "AI Bug Finder · 20 scans / day",
      "AI Chat · 50 messages / day",
      "Gemini Flash models",
      "Email + Google sign-in",
      "ZIP export with manifest",
    ],
  },
  {
    name: "Pro",
    price: "$12",
    period: "/ month",
    tagline: "For serious indie devs and freelancers.",
    icon: Zap,
    highlight: true,
    cta: "Go Pro",
    ctaTo: "/auth",
    features: [
      "Unlimited projects & files",
      "AI Bug Finder · 500 scans / day",
      "AI Chat · 2,000 messages / day",
      "Gemini Pro + GPT-5 Mini access",
      "Priority gateway routing",
      "Diff viewer + Apply-fix history",
      "Email support · 48 h SLA",
    ],
  },
  {
    name: "Premium",
    price: "$39",
    period: "/ month",
    tagline: "For teams shipping production code.",
    icon: Crown,
    cta: "Go Premium",
    ctaTo: "/auth",
    features: [
      "Everything in Pro",
      "Unlimited AI scans & messages",
      "GPT-5 + Gemini 3 Pro access",
      "5 team members included",
      "Shared projects & roles",
      "SSO (Google Workspace)",
      "Priority support · 4 h SLA",
    ],
  },
];

export default function Pricing() {
  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[600px] bg-gradient-glow" />

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

      <section className="mx-auto max-w-3xl px-6 pt-8 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
          <Zap className="h-3 w-3 text-primary" /> Simple, transparent pricing
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
          Pick a plan that grows with you.
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Start free. Upgrade only when you need more AI horsepower or team features. Cancel anytime.
        </p>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 pt-12 md:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`relative flex flex-col rounded-2xl border p-6 shadow-elevated transition-base ${
              p.highlight
                ? "border-primary/50 bg-gradient-surface ring-1 ring-primary/30"
                : "border-border bg-surface-2/60 hover:border-primary/30"
            }`}
          >
            {p.highlight && (
              <span className="absolute -top-2.5 right-6 rounded-full bg-gradient-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground shadow-glow">
                Most popular
              </span>
            )}
            <div className="mb-4 flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${p.highlight ? "bg-gradient-primary shadow-glow" : "bg-surface-3"}`}>
                <p.icon className={`h-4 w-4 ${p.highlight ? "text-primary-foreground" : "text-primary"}`} />
              </div>
              <h2 className="font-display text-xl font-semibold">{p.name}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{p.tagline}</p>
            <div className="mt-5 flex items-baseline gap-1.5">
              <span className="font-display text-4xl font-bold">{p.price}</span>
              <span className="text-sm text-muted-foreground">{p.period}</span>
            </div>

            <ul className="mt-6 flex-1 space-y-2.5">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className={`mt-0.5 h-4 w-4 shrink-0 ${p.highlight ? "text-primary" : "text-success"}`} />
                  <span className="text-foreground/90">{f}</span>
                </li>
              ))}
            </ul>

            <Button
              asChild
              variant={p.highlight ? "hero" : "subtle"}
              size="lg"
              className="mt-6 h-11 w-full"
            >
              <Link to={p.ctaTo}>
                {p.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-20 text-center text-sm text-muted-foreground">
        <p>
          All paid plans include a 14-day money-back guarantee. Need an enterprise plan with
          on-prem deployment, custom SLAs, or a dedicated AI quota? Email{" "}
          <a className="text-primary hover:underline" href="mailto:sales@capraly.app">sales@capraly.app</a>.
        </p>
      </section>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="hover:text-foreground">Home</Link>
          <span>·</span>
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <span>·</span>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
        </div>
        <p className="mt-2 text-muted-foreground/70">© {new Date().getFullYear()} Capraly</p>
      </footer>
    </div>
  );
}
