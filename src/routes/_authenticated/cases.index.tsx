import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listCases } from "@/lib/cases.functions";
import { CategoryTag, StatusBadge, UrgencyBadge, statusLabels } from "@/components/case-badges";

const casesQuery = queryOptions({
  queryKey: ["maintenance_cases"],
  queryFn: () => listCases(),
});

export const Route = createFileRoute("/_authenticated/cases/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(casesQuery);
  },
  head: () => ({
    meta: [
      { title: "Cases — Ovelo" },
      {
        name: "description",
        content:
          "Search, filter and sort every maintenance case running through Ovelo for your agency.",
      },
      { property: "og:title", content: "Cases — Ovelo" },
      {
        property: "og:description",
        content: "The full maintenance case list for your letting agency.",
      },
    ],
  }),
  component: CasesPage,
});

const urgencyRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

function CasesPage() {
  const { data: cases } = useSuspenseQuery(casesQuery);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<"recent" | "urgency">("recent");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cases
      .filter((c) => (status === "all" ? true : c.status === status))
      .filter((c) =>
        q
          ? [c.reference_code, c.tenant_name, c.property_address, c.issue_category]
              .join(" ")
              .toLowerCase()
              .includes(q)
          : true,
      )
      .sort((a, b) =>
        sort === "urgency"
          ? (urgencyRank[a.urgency] ?? 9) - (urgencyRank[b.urgency] ?? 9)
          : new Date(b.reported_at).getTime() - new Date(a.reported_at).getTime(),
      );
  }, [cases, query, status, sort]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Cases</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every maintenance case across your portfolio, newest first.
        </p>
      </header>

      <div className="mb-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reference, tenant, address or category"
          className="w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-input bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        >
          <option value="all">All statuses</option>
          {Object.entries(statusLabels).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "recent" | "urgency")}
          className="rounded-md border border-input bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary"
        >
          <option value="recent">Most recent</option>
          <option value="urgency">Highest urgency</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <div className="hidden grid-cols-[7rem_1.1fr_1.4fr_9rem_8rem] gap-3 border-b border-border bg-secondary px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:grid">
          <span>Reference</span>
          <span>Tenant</span>
          <span>Property</span>
          <span>Urgency</span>
          <span>Status</span>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-10">
            <p className="text-sm font-medium text-ink">
              {cases.length === 0 ? "No cases have been logged yet" : "No cases match your filters"}
            </p>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              {cases.length === 0
                ? "Ovelo creates a case automatically the moment a tenant reports an issue through your channels. Nothing has come in so far."
                : "Try clearing the search box or switching the status filter back to all statuses."}
            </p>
            {cases.length > 0 && (
              <button
                onClick={() => {
                  setQuery("");
                  setStatus("all");
                }}
                className="mt-3 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          rows.map((c) => (
            <Link
              key={c.id}
              to="/cases/$caseId"
              params={{ caseId: c.id }}
              className="grid gap-2 border-b border-border px-5 py-3.5 text-sm transition-colors last:border-b-0 hover:bg-brand-tint lg:grid-cols-[7rem_1.1fr_1.4fr_9rem_8rem] lg:items-center lg:gap-3"
            >
              <span className="font-mono text-[11px] text-muted-foreground">
                {c.reference_code}
              </span>
              <span className="truncate font-medium text-ink">{c.tenant_name}</span>
              <span className="min-w-0">
                <span className="block truncate text-muted-foreground">{c.property_address}</span>
                <span className="mt-1 inline-block">
                  <CategoryTag category={c.issue_category} />
                </span>
              </span>
              <span>
                <UrgencyBadge urgency={c.urgency} />
              </span>
              <span>
                <StatusBadge status={c.status} />
              </span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}