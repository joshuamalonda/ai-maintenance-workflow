import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { listCases, type MaintenanceCase } from "@/lib/cases.functions";
import { UrgencyBadge, statusLabels } from "@/components/case-badges";

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
          "Ovelo overview: live maintenance cases, what needs attention today and the latest activity across your portfolio.",
      },
      { property: "og:title", content: "Overview — Ovelo" },
      {
        property: "og:description",
        content: "Daily operating picture for a letting agency's maintenance workload.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
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

function hoursSince(date: string) {
  return (Date.now() - new Date(date).getTime()) / 3_600_000;
}

const toneClass: Record<string, string> = {
  needs_attention: "bg-critical/10 text-critical",
  in_progress: "bg-brand-tint text-primary",
  completed: "bg-secondary text-muted-foreground",
};

function StatCard({ label, value, delta }: { label: string; value: string; delta: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{delta}</p>
    </div>
  );
}

function JobRow({ c }: { c: MaintenanceCase }) {
  return (
    <Link
      to="/cases/$caseId"
      params={{ caseId: c.id }}
      className="group flex items-start gap-3 border-b border-border px-5 py-3.5 text-sm transition-colors last:border-b-0 hover:bg-brand-tint"
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">{c.reference_code}</span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              toneClass[c.status] ?? toneClass.completed
            }`}
          >
            {statusLabels[c.status] ?? c.status}
          </span>
        </span>
        <span className="mt-1 block truncate font-medium text-ink group-hover:text-primary">
          {c.issue_category} — {c.issue_description}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {c.property_address} · {c.tenant_name}
        </span>
      </span>
      <span className="shrink-0">
        <UrgencyBadge urgency={c.urgency} />
      </span>
    </Link>
  );
}

function Dashboard() {
  const { data: cases } = useSuspenseQuery(casesQuery);

  const open = cases.filter((c) => c.status !== "completed");
  const attention = cases.filter((c) => c.status === "needs_attention");
  const inProgress = cases.filter((c) => c.status === "in_progress");
  const completed = cases.filter((c) => c.status === "completed");
  const stale = attention.filter((c) => hoursSince(c.updated_at) > 24).length;
  const critical = open.filter((c) => c.urgency === "critical" || c.urgency === "high").length;

  const resolutionDays = completed.length
    ? completed.reduce(
        (sum, c) =>
          sum + (new Date(c.updated_at).getTime() - new Date(c.reported_at).getTime()) / 86_400_000,
        0,
      ) / completed.length
    : null;

  const total = cases.length || 1;
  const flow = [
    { label: "Needs attention", value: Math.round((attention.length / total) * 100) },
    { label: "In progress", value: Math.round((inProgress.length / total) * 100) },
    { label: "Completed", value: Math.round((completed.length / total) * 100) },
  ];

  const priority = [...attention, ...inProgress].slice(0, 8);

  const activity = [...cases]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:py-10">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Overview</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {cases.length === 0
              ? "No maintenance cases have reached Ovelo yet. New tenant reports appear here automatically."
              : `${attention.length} case${attention.length === 1 ? "" : "s"} need a decision from your team. Everything else is being handled.`}
          </p>
        </div>
        <Link
          to="/cases"
          className="rounded-md border border-input px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-brand-tint"
        >
          All cases
        </Link>
      </header>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active jobs"
          value={String(open.length)}
          delta={`${critical} high or critical urgency`}
        />
        <StatCard
          label="Awaiting approval"
          value={String(attention.length)}
          delta={stale > 0 ? `${stale} waiting over 24h` : "Nothing overdue"}
        />
        <StatCard
          label="Average resolution time"
          value={resolutionDays === null ? "—" : `${resolutionDays.toFixed(1)} days`}
          delta={completed.length ? `Across ${completed.length} resolved` : "No resolved cases yet"}
        />
        <StatCard
          label="In progress"
          value={String(inProgress.length)}
          delta="Handled by Ovelo, no action needed"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold tracking-tight text-ink">
              Active maintenance jobs
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              {open.length} open
            </span>
          </div>
          {priority.length === 0 ? (
            <div className="px-5 py-10">
              <p className="text-sm font-medium text-ink">No live cases right now</p>
              <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
                Cases appear here the moment a tenant reports an issue through your channels. Ovelo
                triages, assigns a contractor and only escalates what needs a human decision.
              </p>
              <Link
                to="/cases"
                className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
              >
                Open the case list
              </Link>
            </div>
          ) : (
            priority.map((c) => <JobRow key={c.id} c={c} />)
          )}
        </section>

        <div className="space-y-4">
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold tracking-tight text-ink">Case flow</h2>
          <div className="mt-4 space-y-3">
            {flow.map((b) => (
              <div key={b.label}>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{b.label}</span>
                  <span className="font-mono text-[11px] text-ink">{b.value}%</span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${b.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold tracking-tight text-ink">Recent activity</h2>
          </div>
          {activity.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground">
              Activity from calls, contractor updates and tenant messages will stream in here.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {activity.map((c) => (
                <li key={c.id} className="px-5 py-3.5">
                  <Link
                    to="/cases/$caseId"
                    params={{ caseId: c.id }}
                    className="group flex items-start gap-2.5"
                  >
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0">
                      <span className="block text-sm text-ink group-hover:text-primary">
                        {c.last_ai_action ?? `Case updated — ${c.issue_category}`}
                      </span>
                      <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        {c.reference_code} · {relative(c.updated_at)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
        </div>
      </div>
    </div>
  );
}
