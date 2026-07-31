import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listCases, type MaintenanceCase } from "@/lib/cases.functions";
import { StatusBadge, UrgencyBadge } from "@/components/case-badges";

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
      className="group grid gap-2 border-b border-border px-5 py-3.5 text-sm transition-colors last:border-b-0 hover:bg-brand-tint lg:grid-cols-[6.5rem_1.2fr_1.4fr_9rem_9rem] lg:items-center lg:gap-3"
    >
      <span className="font-mono text-[11px] text-muted-foreground">{c.reference_code}</span>
      <span className="min-w-0">
        <span className="block truncate font-medium text-ink group-hover:text-primary">
          {c.property_address}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{c.tenant_name}</span>
      </span>
      <span className="min-w-0">
        <span className="block truncate text-muted-foreground">
          {c.issue_category} — {c.issue_description}
        </span>
      </span>
      <span>
        <UrgencyBadge urgency={c.urgency} />
      </span>
      <span className="flex items-center gap-2">
        <StatusBadge status={c.status} />
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
          label="Open cases"
          value={String(open.length)}
          delta={`${critical} high or critical urgency`}
        />
        <StatCard
          label="Needs attention"
          value={String(attention.length)}
          delta={stale > 0 ? `${stale} waiting over 24h` : "Nothing overdue"}
        />
        <StatCard
          label="In progress"
          value={String(inProgress.length)}
          delta="Handled by Ovelo, no action needed"
        />
        <StatCard
          label="Completed"
          value={String(completed.length)}
          delta="Resolved and closed"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className="flex items-center justify-between border-b border-border px-5 py-3">
            <h2 className="text-sm font-semibold tracking-tight text-ink">Live cases</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Priority order
            </span>
          </div>
          <div className="hidden grid-cols-[6.5rem_1.2fr_1.4fr_9rem_9rem] gap-3 border-b border-border bg-secondary px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:grid">
            <span>Reference</span>
            <span>Property</span>
            <span>Issue</span>
            <span>Urgency</span>
            <span>Status</span>
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
                  <Link to="/cases/$caseId" params={{ caseId: c.id }} className="block group">
                    <p className="text-sm text-ink group-hover:text-primary">
                      {c.last_ai_action ?? `Case updated — ${c.issue_category}`}
                    </p>
                    <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {c.reference_code} · {relative(c.updated_at)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
