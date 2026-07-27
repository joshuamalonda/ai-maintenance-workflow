import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { listCases, type MaintenanceCase } from "@/lib/cases.functions";
import { CategoryTag, StatusBadge, UrgencyBadge } from "@/components/case-badges";

const casesQuery = queryOptions({
  queryKey: ["maintenance_cases"],
  queryFn: () => listCases(),
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(casesQuery);
  },
  head: () => ({
    meta: [
      { title: "Case Console — AI Maintenance Operations" },
      {
        name: "description",
        content:
          "Monitor maintenance cases handled by the AI assistant: needs attention, in progress and completed.",
      },
      { property: "og:title", content: "Case Console — AI Maintenance Operations" },
      {
        property: "og:description",
        content: "Operations console for AI-handled letting maintenance cases.",
      },
    ],
  }),
  component: Dashboard,
});

const sections = [
  {
    key: "needs_attention",
    title: "Needs Attention",
    hint: "AI has escalated or is blocked — human review required",
  },
  { key: "in_progress", title: "In Progress", hint: "AI is actively managing the case" },
  { key: "completed", title: "Completed", hint: "Resolved and closed by the assistant" },
];

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
      className="group grid grid-cols-1 gap-3 border-b border-border px-5 py-4 transition-colors last:border-b-0 hover:bg-brand-soft/50 md:grid-cols-[1.1fr_1.4fr_auto] md:items-center"
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

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-10">
      <header className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">
          Operations console
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-ink">
          Maintenance case queue
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Live view of every maintenance case handled by the AI assistant, grouped by the
          attention it needs from the team.
        </p>
      </header>

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        {sections.map((s) => (
          <div key={s.key} className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {s.title}
            </p>
            <p className="mt-1 text-2xl font-semibold text-ink">
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
                <p className="text-xs text-muted-foreground">{s.hint}</p>
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-surface">
                {rows.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                    No cases in this section.
                  </p>
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
