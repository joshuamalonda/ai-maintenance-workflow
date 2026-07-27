import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — AI Maintenance Operations" },
      {
        name: "description",
        content:
          "Sign in to the AI Maintenance Operations console to review maintenance cases handled by the assistant.",
      },
      { property: "og:title", content: "Sign in — AI Maintenance Operations" },
      {
        property: "og:description",
        content: "Staff sign-in for the AI maintenance operations console.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    const fn =
      mode === "signin"
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: window.location.origin },
          });
    const { data, error } = await fn;
    setBusy(false);
    if (error) return setMessage(error.message);
    if (data.session) navigate({ to: "/", replace: true });
    else setMessage("Check your inbox to confirm your email address.");
  }

  async function onGoogle() {
    setMessage(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) return setMessage("Google sign-in failed. Please try again.");
    if (result.redirected) return;
    navigate({ to: "/", replace: true });
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-col justify-center px-6 py-20">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
        Operations console
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        {mode === "signin" ? "Sign in to continue" : "Create your console account"}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Maintenance case data is restricted to authorised staff.
      </p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <div>
          <label htmlFor="email" className="text-xs uppercase tracking-wide text-muted-foreground">
            Work email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <div>
          <label
            htmlFor="password"
            className="text-xs uppercase tracking-wide text-muted-foreground"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        onClick={onGoogle}
        className="mt-3 w-full rounded-md border border-input bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-accent"
      >
        Continue with Google
      </button>

      {message && <p className="mt-4 text-sm text-muted-foreground">{message}</p>}

      <button
        onClick={() => {
          setMode(mode === "signin" ? "signup" : "signin");
          setMessage(null);
        }}
        className="mt-6 text-sm font-medium text-primary hover:underline"
      >
        {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </main>
  );
}
