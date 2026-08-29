import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { OveloMark } from "@/components/ovelo-logo";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — Ovelo" },
      {
        name: "description",
        content:
          "Sign in to Ovelo, the operations console letting agency teams use to run maintenance cases.",
      },
      { property: "og:title", content: "Sign in — Ovelo" },
      {
        property: "og:description",
        content: "Staff sign-in for the Ovelo operations console.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search.next === "string" ? search.next : undefined,
  }),
  component: AuthPage,
});

/** Only same-origin relative paths are accepted as a post-sign-in return target. */
function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : null;
}

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const returnTo = safeNext(next);
  const goHome = () => {
    if (returnTo) window.location.replace(returnTo);
    else navigate({ to: "/", replace: true });
  };
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) goHome();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, returnTo]);

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
            options: {
              emailRedirectTo: returnTo
                ? `${window.location.origin}${returnTo}`
                : window.location.origin,
            },
          });
    const { data, error } = await fn;
    setBusy(false);
    if (error) return setMessage(error.message);
    if (data.session) goHome();
    else setMessage("Check your inbox to confirm your email address.");
  }

  async function onGoogle() {
    setMessage(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: returnTo ? `${window.location.origin}${returnTo}` : window.location.origin,
    });
    if (result.error) return setMessage("Google sign-in failed. Please try again.");
    if (result.redirected) return;
    goHome();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-md border border-border bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-2.5">
          <OveloMark />
          <span className="text-[15px] font-semibold tracking-tight text-ink">Ovelo</span>
        </div>
        <h1 className="mt-6 text-xl font-semibold tracking-tight text-ink">
          {mode === "signin" ? "Sign in to your workspace" : "Create your Ovelo account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Maintenance case data is restricted to authorised agency staff.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
          className="mt-3 w-full rounded-md border border-input bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-brand-tint"
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
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Ovelo Technologies
      </p>
    </main>
  );
}
