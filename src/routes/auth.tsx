import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { supabase } from "@/integrations/supabase/client";

type Search = { next?: string | undefined };

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to your Satphonix client portal" },
      {
        name: "description",
        content:
          "Sign in to track your Satphonix project, complete onboarding and upload the assets we need to build your system.",
      },
      { property: "og:title", content: "Satphonix client portal sign in" },
      { property: "og:description", content: "Access your project, onboarding and order history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): Search => ({
    next: typeof search["next"] === "string" ? search["next"] : undefined,
  }),
  ssr: false,
  component: AuthPage,
});

type Mode = "signin" | "signup" | "magic" | "reset";

function AuthPage() {
  const navigate = useNavigate();
  const { next } = useSearch({ from: "/auth" });
  const destination = next && next.startsWith("/") ? next : "/portal";

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void navigate({ to: destination });
    });
  }, [destination, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (mode === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        await navigate({ to: destination });
      } else if (mode === "signup") {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { full_name: fullName },
          },
        });
        if (signUpError) throw signUpError;
        const { data } = await supabase.auth.getSession();
        if (data.session) await navigate({ to: destination });
        else setMessage("Check your inbox to confirm your email address, then sign in.");
      } else if (mode === "magic") {
        const { error: otpError } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${window.location.origin}${destination}` },
        });
        if (otpError) throw otpError;
        setMessage("We've emailed you a secure sign-in link.");
      } else {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (resetError) throw resetError;
        setMessage("If that email has an account, a reset link is on its way.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader minimal />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-16">
        <p className="eyebrow">Client portal</p>
        <h1 className="display mt-3 text-3xl">
          {mode === "signup" ? "Create your account" : mode === "reset" ? "Reset your password" : "Welcome back"}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Use the email address on your Satphonix order. Your project, onboarding and payment record are waiting.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          {mode === "signup" && (
            <div>
              <label className="text-sm font-medium" htmlFor="fullName">
                Your name
              </label>
              <input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none focus:border-primary"
                autoComplete="name"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none focus:border-primary"
              autoComplete="email"
            />
          </div>

          {(mode === "signin" || mode === "signup") && (
            <div>
              <label className="text-sm font-medium" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none focus:border-primary"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </div>
          )}

          {error && <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</p>}
          {message && <p className="rounded-xl bg-accent/10 px-4 py-3 text-sm">{message}</p>}

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-base font-medium text-primary-foreground disabled:opacity-60"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "signin"
              ? "Sign in"
              : mode === "signup"
                ? "Create account"
                : mode === "magic"
                  ? "Email me a sign-in link"
                  : "Send reset link"}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-2 text-sm text-muted-foreground">
          {mode !== "signin" && (
            <button type="button" className="text-left underline" onClick={() => setMode("signin")}>
              Sign in with a password
            </button>
          )}
          {mode !== "signup" && (
            <button type="button" className="text-left underline" onClick={() => setMode("signup")}>
              I've paid but haven't created an account yet
            </button>
          )}
          {mode !== "magic" && (
            <button type="button" className="text-left underline" onClick={() => setMode("magic")}>
              Email me a secure sign-in link instead
            </button>
          )}
          {mode !== "reset" && (
            <button type="button" className="text-left underline" onClick={() => setMode("reset")}>
              I've forgotten my password
            </button>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
