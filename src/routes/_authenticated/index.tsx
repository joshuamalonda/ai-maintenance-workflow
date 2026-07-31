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
          "Ovelo overview: maintenance cases needing attention, work in progress and recently completed.",
      },
      { property: "og:title", content: "Overview — Ovelo" },
      {
        property: "og:description",
        content: "Daily operating picture for a letting agency's maintenance workload.",
      },
    ],
  }),
  component: Dashboard,
});

const sections = [
  {
    key: "needs_attention",
    title: "Needs Attention",
    hint: "Escalated or blocked — a team decision is required",
  },
  { key: "in_progress", title: "In Progress", hint: "Being handled automatically, no action needed" },
  { key: "completed", title: "Completed", hint: "Resolved and closed in the last cycle" },
];

const emptyCopy: Record<string, { title: string; body: string }> = {
  needs_attention: {
    title: "Nothing is waiting on your team",
    body: "Cases appear here when Ovelo cannot resolve them alone — for example a quote above your approval limit or a tenant who has not responded.",
  },
  in_progress: {
    title: "No live cases right now",
    body: "Cases move here as soon as they are triaged and a contractor or tenant reply is being chased.",
  },
  completed: {
    title: "No completed cases yet",
    body: "Resolved cases are archived here with their full timeline so you can review how each one was handled.",
  },
};

function relative(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const h = Math.round(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function CaseRow({ c }: { c: MaintenanceCase }) {
  return (
    <Link
      to="/cases/$caseId"
      params={{ caseId: c.id }}
      className="group grid grid-cols-1 gap-3 border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-brand-tint md:grid-cols-[1.1fr_1.4fr_auto] md:items-center"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">
            {c.reference_code}
          </span>
          <UrgencyBadge urgency={c.urgency} />
        </div>
        <p className="mt-1 truncate font-medium text-ink group-hover:text-primary">
          {c.tenant_name}
        </p>
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm text-muted-foreground">{c.property_address}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <CategoryTag category={c.issue_category} />
          <StatusBadge status={c.status} />
        </div>
      </div>
      <div className="text-left text-xs text-muted-foreground md:text-right">
        {relative(c.reported_at)}
      </div>
    </Link>
  );
}

function Dashboard() {
  const { data: cases } = useSuspenseQuery(casesQuery);
  const total = cases.length;
  const attention = cases.filter((c) => c.status === "needs_attention").length;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          Today at your agency
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          {total === 0
            ? "No maintenance cases have reached Ovelo yet. New reports from tenants appear here automatically."
            : `${attention} of ${total} open case${total === 1 ? "" : "s"} need a decision from your team. Everything else is being handled.`}
        </p>
      </header>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {sections.map((s) => (
          <div key={s.key} className="rounded-md border border-border bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {s.title}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-ink">
              {cases.filter((c) => c.status === s.key).length}
            </p>
          </div>
        ))}
      </div>

      <div className="space-y-8">
        {sections.map((s) => {
          const rows = cases.filter((c) => c.status === s.key);
          return (
            <section key={s.key}>
              <div className="mb-3 flex items-baseline justify-between gap-4">
                <h2 className="text-lg font-semibold tracking-tight text-ink">{s.title}</h2>
                <p className="hidden text-xs text-muted-foreground sm:block">{s.hint}</p>
              </div>
              <div className="overflow-hidden rounded-md border border-border bg-surface">
                {rows.length === 0 ? (
                  <div className="px-5 py-8">
                    <p className="text-sm font-medium text-ink">{emptyCopy[s.key].title}</p>
                    <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
                      {emptyCopy[s.key].body}
                    </p>
                    <Link
                      to="/cases"
                      className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                    >
                      Open the case list
                    </Link>
                  </div>
                ) : (
                  rows.map((c) => <CaseRow key={c.id} c={c} />)
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
