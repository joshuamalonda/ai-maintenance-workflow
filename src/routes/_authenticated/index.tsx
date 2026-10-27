import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { listCases, type MaintenanceCase } from "@/lib/cases.functions";
import { UrgencyBadge, statusLabels } from "@/components/case-badges";
import { useCasesRealtime } from "@/hooks/use-cases-realtime";

const casesQuery = queryOptions({
  queryKey: ["maintenance_cases"],
  queryFn: () => listCases(),
});

export const Route = createFileRoute("/_authenticated/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(casesQuery);
  },
  head: () => ({
    meta: [
      { title: "Overview — Ovelo" },
      {
        name: "description",
        content:
          "Ovelo maintenance operations overview: active cases, emergencies, cases awaiting review and average response time.",
      },
      { property: "og:title", content: "Overview — Ovelo" },
      {
        property: "og:description",
        content: "Live operating picture for a letting agency's maintenance workload.",
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
  component: Dashboard,
});

function relative(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.round(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr${h === 1 ? "" : "s"} ago`;
  return `${Math.round(h / 24)}d ago`;
}

const toneClass: Record<string, string> = {
  needs_attention: "bg-critical/10 text-critical",
  in_progress: "bg-brand-tint text-primary",
  completed: "bg-secondary text-muted-foreground",
};

function StatCard({
  label,
  value,
  note,
  icon: Icon,
  emphasis,
}: {
  label: string;
  value: string;
  note: string;
  icon: LucideIcon;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border bg-surface p-4 ${
        emphasis ? "border-critical/35" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <Icon className={`size-4 ${emphasis ? "text-critical" : "text-muted-foreground"}`} />
      </div>
      <p
        className={`mt-3 text-3xl font-semibold tabular-nums tracking-tight ${
          emphasis ? "text-critical" : "text-ink"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function CaseRow({ c }: { c: MaintenanceCase }) {
  return (
    <Link
      to="/cases/$caseId"
      params={{ caseId: c.id }}
      className="group grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border px-5 py-3.5 text-sm transition-colors last:border-b-0 hover:bg-brand-tint"
    >
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">{c.reference_code}</span>
          <span
            className={`rounded px-2 py-0.5 text-[10px] font-medium ${
              toneClass[c.status] ?? toneClass.completed
            }`}
          >
            {statusLabels[c.status] ?? c.status}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {relative(c.created_at)}
          </span>
        </span>
        <span className="mt-1 block truncate font-medium text-ink group-hover:text-primary">
          {c.issue_category} — {c.issue_description}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {c.property_address} · {c.tenant_name}
        </span>
      </span>
      <span className="shrink-0 pt-0.5">
        <UrgencyBadge urgency={c.urgency} />
      </span>
    </Link>
  );
}

function Dashboard() {
  useCasesRealtime();
  const { data: cases } = useSuspenseQuery(casesQuery);

  const active = cases.filter((c) => c.status !== "completed");
  const latest = [...cases]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Overview</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Live maintenance operations across your portfolio. Updates arrive automatically as cases
          are logged and handled.
        </p>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          label="Active cases"
          value={String(active.length)}
          note="Open and not yet completed"
          icon={ClipboardList}
        />
      </section>

      <section className="mt-8 overflow-hidden rounded-lg border border-border bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink">Latest maintenance cases</h2>
          <Link to="/cases" className="text-xs font-medium text-primary hover:underline">
            View all
          </Link>
        </div>
        {latest.length === 0 ? (
          <div className="px-5 py-14 text-center">
            <p className="text-sm font-medium text-ink">No maintenance cases yet</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Cases appear here the moment they are written to your maintenance case records. This
              view is live — nothing needs refreshing.
            </p>
          </div>
        ) : (
          latest.map((c) => <CaseRow key={c.id} c={c} />)
        )}
      </section>
    </div>
  );
}
