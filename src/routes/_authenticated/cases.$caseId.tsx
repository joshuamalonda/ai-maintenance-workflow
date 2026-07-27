import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { getCase } from "@/lib/cases.functions";
import { CategoryTag, StatusBadge, UrgencyBadge, statusLabels } from "@/components/case-badges";

const caseQuery = (id: string) =>
  queryOptions({
    queryKey: ["maintenance_cases", id],
    queryFn: () => getCase({ data: { id } }),
  });

export const Route = createFileRoute("/_authenticated/cases/$caseId")({
  loader: async ({ context, params }) => {
    const found = await context.queryClient.ensureQueryData(caseQuery(params.caseId));
    if (!found) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Case detail — Ovelo" },
      {
        name: "description",
        content:
          "Case summary, issue description and case information for a single Ovelo maintenance case.",
      },
      { property: "og:title", content: "Case detail — Ovelo" },
      {
        property: "og:description",
        content: "Full detail for a maintenance case handled in Ovelo.",
      },
    ],
  }),
  errorComponent: () => <Fallback title="This case didn't load" />,
  notFoundComponent: () => <Fallback title="Case not found" />,
  component: CaseDetail,
});

function Fallback({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <Link
        to="/cases"
        className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
      >
        Back to cases
      </Link>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border py-3 last:border-b-0">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm text-ink">{value}</dd>
    </div>
  );
}

function CaseDetail() {
  const { caseId } = Route.useParams();
  const { data } = useSuspenseQuery(caseQuery(caseId));
  if (!data) return <Fallback title="Case not found" />;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10">
      <Link to="/cases" className="text-sm font-medium text-primary hover:underline">
        ← Cases
      </Link>

      <header className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{data.reference_code}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
            {data.issue_category} — {data.tenant_name}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{data.property_address}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <UrgencyBadge urgency={data.urgency} />
          <StatusBadge status={data.status} />
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="space-y-6">
          <section className="rounded-md border border-primary/25 bg-brand-tint p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-mono text-xs uppercase tracking-[0.18em] text-accent-foreground">
                Case summary
              </h2>
              {data.ai_confidence != null && (
                <span className="font-mono text-xs text-accent-foreground">
                  confidence {Math.round(Number(data.ai_confidence) * 100)}%
                </span>
              )}
            </div>
            <p className="mt-3 text-sm leading-relaxed text-ink">
              {data.ai_summary ??
                "Ovelo has not produced a summary for this case yet. It appears once the first tenant or contractor exchange has been processed."}
            </p>
            {data.last_ai_action && (
              <p className="mt-4 border-t border-primary/20 pt-3 text-xs text-accent-foreground">
                Last action: {data.last_ai_action}
              </p>
            )}
          </section>

          <section className="rounded-md border border-border bg-surface p-5">
            <h2 className="text-sm font-semibold text-ink">Issue description</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {data.issue_description}
            </p>
          </section>
        </div>

        <aside className="rounded-md border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-ink">Case information</h2>
          <dl className="mt-2">
            <Field label="Tenant" value={data.tenant_name} />
            <Field label="Property address" value={data.property_address} />
            <Field label="Issue category" value={data.issue_category} />
            <Field label="Urgency" value={data.urgency} />
            <Field label="Status" value={statusLabels[data.status] ?? data.status} />
            <Field label="Source channel" value={data.source_channel} />
            <Field
              label="Reported"
              value={new Date(data.reported_at).toLocaleString("en-GB")}
            />
            <Field
              label="Last updated"
              value={new Date(data.updated_at).toLocaleString("en-GB")}
            />
          </dl>
          <div className="mt-4">
            <CategoryTag category={data.issue_category} />
          </div>
        </aside>
      </div>
    </div>
  );
}