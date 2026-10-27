import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { OveloMark } from "@/components/ovelo-logo";
import { createMyAgency, getMyAgency } from "@/lib/onboarding.functions";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const agency = await getMyAgency();
    if (agency) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Set up your agency — Ovelo" },
      {
        name: "description",
        content:
          "Create your Ovelo workspace so your agency's maintenance cases, properties and contractors stay isolated to your team.",
      },
      { property: "og:title", content: "Set up your agency — Ovelo" },
      {
        property: "og:description",
        content: "Create your Ovelo agency workspace to get started.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => (
    <div role="alert" className="mx-auto max-w-2xl px-6 py-24 text-center text-sm text-ink">
      {error instanceof Error ? error.message : "Something went wrong"}
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center text-sm text-ink">Not found</div>
  ),
  component: OnboardingPage,
});

function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (agencyName: string) => createMyAgency({ data: { name: agencyName } }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries();
      navigate({ to: "/", replace: true });
    },
    onError: (err: Error) =>
      setError(err.message || "Could not create your agency. Please try again."),
  });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-16">
      <div className="rounded-md border border-border bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-2.5">
          <OveloMark />
          <span className="text-[15px] font-semibold tracking-tight text-ink">Ovelo</span>
        </div>

        <h1 className="mt-6 text-xl font-semibold tracking-tight text-ink">Set up your agency</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create your OVELO workspace to get started.
        </p>

        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            if (mutation.isPending) return;
            const trimmed = name.trim();
            if (trimmed.length < 2) {
              setError("Enter your agency name.");
              return;
            }
            setError(null);
            mutation.mutate(trimmed);
          }}
        >
          <label
            htmlFor="agency-name"
            className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
          >
            Agency name
          </label>
          <input
            id="agency-name"
            autoFocus
            autoComplete="organization"
            placeholder="e.g. GoGo Real Estate"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={mutation.isPending}
            className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-muted-foreground focus:border-primary disabled:opacity-60"
          />

          <button
            type="submit"
            disabled={mutation.isPending}
            className="mt-4 w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {mutation.isPending ? "Creating…" : "Create agency"}
          </button>

          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}
        </form>

        <p className="mt-6 text-xs text-muted-foreground">
          Your properties, tenants, contractors and cases stay private to this workspace.
        </p>
      </div>
    </main>
  );
}
