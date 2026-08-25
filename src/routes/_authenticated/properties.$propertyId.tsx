import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  assignContractor,
  createContractor,
  getProperty,
  listContractors,
  unassignContractor,
} from "@/lib/properties.functions";
import { PropertyFormDialog } from "@/components/property-form-dialog";
import { CategoryTag, StatusBadge, UrgencyBadge } from "@/components/case-badges";

const propertyQuery = (id: string) =>
  queryOptions({
    queryKey: ["properties", id],
    queryFn: () => getProperty({ data: { id } }),
  });

export const Route = createFileRoute("/_authenticated/properties/$propertyId")({
  loader: async ({ context, params }) => {
    const found = await context.queryClient.ensureQueryData(propertyQuery(params.propertyId));
    if (!found) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Property detail — Ovelo" },
      {
        name: "description",
        content:
          "Property detail: landlord, tenant, assigned contractors and the maintenance cases raised at this address.",
      },
      { property: "og:title", content: "Property detail — Ovelo" },
      {
        property: "og:description",
        content: "Landlord, tenant, contractors and maintenance history for a managed property.",
      },
    ],
  }),
  errorComponent: () => <Fallback title="This property didn't load" />,
  notFoundComponent: () => <Fallback title="Property not found" />,
  component: PropertyDetail,
});

function Fallback({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <Link to="/properties" className="mt-4 inline-block text-sm font-medium text-primary hover:underline">
        Back to properties
      </Link>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-border py-3 last:border-b-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-ink">{value}</dd>
    </div>
  );
}

function Panel({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section className="rounded-md border border-border bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <h2 className="text-sm font-medium text-ink">{title}</h2>
        {aside}
      </header>
      <div className="px-5 py-3">{children}</div>
    </section>
  );
}

function PropertyDetail() {
  const { propertyId } = Route.useParams();
  const { data } = useSuspenseQuery(propertyQuery(propertyId));
  if (!data) return <Fallback title="Property not found" />;

  const { property, contractors, cases } = data;
  const landlord = property.landlord;
  const tenant = property.tenant;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <Link to="/properties" className="text-sm font-medium text-primary hover:underline">
        ← Properties
      </Link>

      <header className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {property.address}
          </h1>
          <p className="mt-1 font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
            {property.postcode ?? "No postcode"}
          </p>
        </div>
        <PropertyFormDialog
          property={{
            id: property.id,
            address: property.address,
            postcode: property.postcode,
            landlord_id: property.landlord_id,
            tenant_id: property.tenant_id,
          }}
          trigger={
            <button className="rounded-md border border-input px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-brand-tint">
              Edit property
            </button>
          }
        />
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Landlord">
          {landlord ? (
            <dl>
              <Field label="Name" value={landlord.name} />
              <Field label="Phone" value={landlord.phone ?? "—"} />
              <Field label="Email" value={landlord.email ?? "—"} />
            </dl>
          ) : (
            <p className="py-3 text-sm text-muted-foreground">No landlord linked.</p>
          )}
        </Panel>

        <Panel title="Tenant">
          {tenant ? (
            <dl>
              <Field label="Name" value={tenant.name} />
              <Field label="Phone" value={tenant.phone ?? "—"} />
              <Field label="Email" value={tenant.email ?? "—"} />
            </dl>
          ) : (
            <p className="py-3 text-sm text-muted-foreground">No tenant linked.</p>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <ContractorsPanel
          propertyId={property.id}
          assigned={contractors}
        />
      </div>

      <div className="mt-4">
        <Panel title="Maintenance cases">
          {cases.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">
              No maintenance cases recorded at this address yet.
            </p>
          ) : (
            <div className="-mx-5">
              {cases.map((c) => (
                <Link
                  key={c.id}
                  to="/cases/$caseId"
                  params={{ caseId: c.id }}
                  className="grid gap-2 border-b border-border px-5 py-3 text-sm transition-colors last:border-b-0 hover:bg-brand-tint lg:grid-cols-[7rem_1fr_8rem_8rem] lg:items-center"
                >
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {c.reference_code}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-ink">{c.tenant_name}</span>
                    <span className="mt-1 inline-block">
                      <CategoryTag category={c.issue_category} />
                    </span>
                  </span>
                  <UrgencyBadge urgency={c.urgency} />
                  <StatusBadge status={c.status} />
                </Link>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function ContractorsPanel({
  propertyId,
  assigned,
}: {
  propertyId: string;
  assigned: Array<{
    linkId: string;
    contractor: { id: string; name: string; company: string | null; trade: string | null; phone: string | null; email: string | null };
  }>;
}) {
  const queryClient = useQueryClient();
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState({ name: "", company: "", trade: "", phone: "", email: "" });
  const [addingNew, setAddingNew] = useState(false);

  const all = useQuery({
    queryKey: ["contractors"],
    queryFn: () => listContractors(),
    enabled: picking,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["properties", propertyId] });
    queryClient.invalidateQueries({ queryKey: ["contractors"] });
  };

  const assign = useMutation({
    mutationFn: (contractor_id: string) =>
      assignContractor({ data: { property_id: propertyId, contractor_id } }),
    onSuccess: (r) => {
      refresh();
      setPicking(false);
      setQuery("");
      toast.success(r.created ? "Contractor assigned" : "Contractor already assigned");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (link_id: string) => unassignContractor({ data: { link_id } }),
    onSuccess: () => {
      refresh();
      toast.success("Contractor removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: () => createContractor({ data: draft }),
    onSuccess: (c) => {
      setAddingNew(false);
      setDraft({ name: "", company: "", trade: "", phone: "", email: "" });
      assign.mutate(c.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignedIds = new Set(assigned.map((a) => a.contractor.id));
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (all.data ?? [])
      .filter((c) => !assignedIds.has(c.id))
      .filter((c) =>
        q ? [c.name, c.company ?? "", c.trade ?? ""].join(" ").toLowerCase().includes(q) : true,
      )
      .slice(0, 8);
  }, [all.data, query, assigned]);

  const inputClass =
    "w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-muted-foreground focus:border-primary";

  return (
    <Panel
      title="Contractors"
      aside={
        <button
          onClick={() => setPicking((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-brand-tint"
        >
          <Plus className="size-3.5" /> Assign contractor
        </button>
      }
    >
      {assigned.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">No contractors assigned</p>
      ) : (
        <div className="-mx-5">
          {assigned.map((a) => (
            <div
              key={a.linkId}
              className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 last:border-b-0"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink">
                  {a.contractor.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {[a.contractor.trade, a.contractor.company, a.contractor.phone]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
              </span>
              <button
                onClick={() => remove.mutate(a.linkId)}
                disabled={remove.isPending}
                aria-label={`Remove ${a.contractor.name}`}
                className="shrink-0 rounded-md border border-input p-1.5 text-muted-foreground transition-colors hover:bg-brand-tint hover:text-ink"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {picking && (
        <div className="mt-3 rounded-md border border-border p-3">
          {!addingNew ? (
            <>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search existing contractors"
                  className={`${inputClass} pl-8`}
                />
              </div>
              <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-border">
                {all.isLoading ? (
                  <p className="px-3 py-3 text-xs text-muted-foreground">Loading…</p>
                ) : results.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-muted-foreground">No matches.</p>
                ) : (
                  results.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => assign.mutate(c.id)}
                      className="block w-full border-b border-border px-3 py-2 text-left text-sm text-ink transition-colors last:border-b-0 hover:bg-brand-tint"
                    >
                      <span className="block truncate">{c.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[c.trade, c.company].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <button
                onClick={() => {
                  setDraft({ ...draft, name: query.trim() });
                  setAddingNew(true);
                }}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <Plus className="size-3.5" /> Add a new contractor
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="Contractor name"
                className={inputClass}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={draft.company}
                  onChange={(e) => setDraft({ ...draft, company: e.target.value })}
                  placeholder="Company (optional)"
                  className={inputClass}
                />
                <input
                  value={draft.trade}
                  onChange={(e) => setDraft({ ...draft, trade: e.target.value })}
                  placeholder="Trade (optional)"
                  className={inputClass}
                />
                <input
                  value={draft.phone}
                  onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
                  placeholder="Phone (optional)"
                  className={inputClass}
                />
                <input
                  value={draft.email}
                  onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                  placeholder="Email (optional)"
                  className={inputClass}
                />
              </div>
              <div className="flex gap-2">
                <button
                  disabled={!draft.name.trim() || create.isPending}
                  onClick={() => create.mutate()}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  {create.isPending ? "Saving…" : "Save and assign"}
                </button>
                <button
                  onClick={() => setAddingNew(false)}
                  className="rounded-md border border-input px-3 py-1.5 text-xs font-medium text-ink"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
