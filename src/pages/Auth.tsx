import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Sparkles, Mail, Lock } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4">
    <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" opacity=".9"/>
    <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" opacity=".7"/>
    <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" opacity=".5"/>
  </svg>
);

export default function Auth() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!loading && user) navigate("/editor", { replace: true });
  }, [user, loading, navigate]);

  const handleEmailAuth = async (mode: "signin" | "signup") => {
    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/editor` },
        });
        if (error) throw error;
        toast.success("Account created. You're in!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back");
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handleOAuth = async (provider: "google" | "apple") => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}/editor`,
      });
      if (result.error) throw result.error;
    } catch (e: any) {
      toast.error(e?.message ?? `${provider} sign-in failed`);
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 bg-gradient-glow">
      <div className="absolute inset-0 -z-10 bg-gradient-glow" />
      <div className="w-full max-w-md animate-slide-up">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-primary shadow-glow">
            <Sparkles className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Welcome to <span className="text-gradient-primary">Capraly</span>
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            AI-powered code editor & bug finder
          </p>
        </div>

        <div className="glass rounded-2xl p-6 shadow-elevated">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2 bg-surface-1">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Sign up</TabsTrigger>
            </TabsList>

            {(["signin", "signup"] as const).map((mode) => (
              <TabsContent key={mode} value={mode} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`${mode}-email`}>Email</Label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id={`${mode}-email`}
                      type="email"
                      placeholder="you@dev.com"
                      autoComplete="email"
                      className="pl-9 bg-surface-1"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`${mode}-password`}>Password</Label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id={`${mode}-password`}
                      type="password"
                      placeholder="••••••••"
                      autoComplete={mode === "signup" ? "new-password" : "current-password"}
                      className="pl-9 bg-surface-1"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  variant="hero"
                  className="w-full"
                  disabled={busy}
                  onClick={() => handleEmailAuth(mode)}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (mode === "signin" ? "Sign in" : "Create account")}
                </Button>
              </TabsContent>
            ))}
          </Tabs>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs uppercase tracking-wider text-muted-foreground">or</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full bg-surface-1 hover:bg-surface-2"
              disabled={busy}
              onClick={() => handleOAuth("google")}
            >
              <GoogleIcon />
              <span className="ml-2">Continue with Google</span>
            </Button>
            <Button
              variant="outline"
              className="w-full bg-surface-1 hover:bg-surface-2"
              disabled={busy}
              onClick={() => handleOAuth("apple")}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                <path d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.24-.02-.317-.06-.06-1.13.473-2.31 1.137-3.07.694-.85 1.97-1.55 2.985-1.62.04.06.06.13.06.2zm4.565 17.8c-.063.165-.314 1.05-1.005 1.97-.582.79-1.19 1.59-2.16 1.6-.953.02-1.27-.55-2.36-.55-1.094 0-1.434.54-2.34.57-.93.03-1.638-.85-2.225-1.64-1.196-1.64-2.114-4.66-.886-6.7.61-1.02 1.704-1.66 2.886-1.68.928-.02 1.81.62 2.378.62.567 0 1.638-.76 2.762-.65.47.02 1.795.19 2.642 1.42-.07.04-1.59.92-1.575 2.78.014 2.21 1.94 2.94 1.96 2.95z"/>
              </svg>
              <span className="ml-2">Continue with Apple</span>
            </Button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to use AI features responsibly.
        </p>
      </div>
    </div>
  );
}
