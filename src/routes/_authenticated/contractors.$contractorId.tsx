import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  assignContractorToProperty,
  getContractor,
  setContractorActive,
  unassignContractorFromProperty,
  deleteAgencyContractor,
} from "@/lib/contractors.functions";
import { listProperties } from "@/lib/properties.functions";
import { ContractorFormDialog } from "@/components/contractor-form-dialog";
import { DeleteRecordButton } from "@/components/delete-record-button";

const contractorQuery = (id: string) =>
  queryOptions({
    queryKey: ["contractors", id],
    queryFn: () => getContractor({ data: { id } }),
  });

export const Route = createFileRoute("/_authenticated/contractors/$contractorId")({
  loader: async ({ context, params }) => {
    const found = await context.queryClient.ensureQueryData(
      contractorQuery(params.contractorId),
    );
    if (!found) throw notFound();
  },
  head: () => ({
    meta: [
      { title: "Contractor detail — Ovelo" },
      {
        name: "description",
        content:
          "Contractor detail: contact information, availability status and the properties they are assigned to.",
      },
      { property: "og:title", content: "Contractor detail — Ovelo" },
      {
        property: "og:description",
        content: "Contact details, status and property assignments for one of your contractors.",
      },
    ],
  }),
  errorComponent: () => <Fallback title="This contractor didn't load" />,
  notFoundComponent: () => <Fallback title="Contractor not found" />,
  component: ContractorDetailPage,
});

function Fallback({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-2xl px-6 py-24 text-center">
      <h1 className="text-xl font-semibold text-ink">{title}</h1>
      <Link
        to="/contractors"
        className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
      >
        Back to contractors
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

function Panel({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
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

function ContractorDetailPage() {
  const { contractorId } = Route.useParams();
  const { data } = useSuspenseQuery(contractorQuery(contractorId));
  const queryClient = useQueryClient();

  const toggleActive = useMutation({
    mutationFn: (active: boolean) => setContractorActive({ data: { id: contractorId, active } }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["contractors"] });
      toast.success(r.active ? "Contractor activated" : "Contractor deactivated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!data) return <Fallback title="Contractor not found" />;
  const { contractor, properties } = data;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-10">
      <Link to="/contractors" className="text-sm font-medium text-primary hover:underline">
        ← Contractors
      </Link>

      <header className="mt-3 mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {contractor.name}
          </h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <span>{[contractor.trade, contractor.company].filter(Boolean).join(" · ") || "—"}</span>
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
                contractor.active
                  ? "bg-brand-tint text-primary"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {contractor.active ? "Active" : "Inactive"}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => toggleActive.mutate(!contractor.active)}
            disabled={toggleActive.isPending}
            className="rounded-md border border-input px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-brand-tint disabled:opacity-50"
          >
            {contractor.active ? "Deactivate" : "Activate"}
          </button>
          <ContractorFormDialog
            contractor={contractor}
            trigger={
              <button className="rounded-md border border-input px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-brand-tint">
                Edit contractor
              </button>
            }
          />
          <DeleteRecordButton
            label="contractor"
            name={contractor.name}
            description="This removes the contractor and their property assignments from your directory. Maintenance cases are kept, but any assignment to this contractor is cleared. This cannot be undone."
            onDelete={() => deleteAgencyContractor({ data: { id: contractor.id } })}
            invalidateKeys={[["contractors"], ["maintenance_cases"]]}
            redirectTo="/contractors"
          />
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Contractor details">
          <dl>
            <Field label="Contact name" value={contractor.name} />
            <Field label="Company" value={contractor.company ?? "—"} />
            <Field label="Trade" value={contractor.trade ?? "—"} />
          </dl>
        </Panel>
        <Panel title="Contact">
          <dl>
            <Field label="Phone" value={contractor.phone ?? "—"} />
            <Field label="WhatsApp" value={contractor.whatsapp ?? "—"} />
            <Field label="Email" value={contractor.email ?? "—"} />
          </dl>
        </Panel>
      </div>

      <div className="mt-4">
        <PropertiesPanel contractorId={contractorId} assigned={properties} />
      </div>
    </div>
  );
}

function PropertiesPanel({
  contractorId,
  assigned,
}: {
  contractorId: string;
  assigned: Array<{
    linkId: string;
    property: { id: string; address: string; postcode: string | null };
  }>;
}) {
  const queryClient = useQueryClient();
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");

  const all = useQuery({
    queryKey: ["properties"],
    queryFn: () => listProperties(),
    enabled: picking,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["contractors", contractorId] });
    queryClient.invalidateQueries({ queryKey: ["properties"] });
  };

  const assign = useMutation({
    mutationFn: (property_id: string) =>
      assignContractorToProperty({ data: { contractor_id: contractorId, property_id } }),
    onSuccess: (r) => {
      refresh();
      setQuery("");
      setPicking(false);
      toast.success(r.created ? "Property assigned" : "Contractor already assigned here");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (link_id: string) => unassignContractorFromProperty({ data: { link_id } }),
    onSuccess: () => {
      refresh();
      toast.success("Property removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const assignedIds = new Set(assigned.map((a) => a.property.id));
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (all.data ?? [])
      .filter((p) => !assignedIds.has(p.id))
      .filter((p) =>
        q ? [p.address, p.postcode ?? ""].join(" ").toLowerCase().includes(q) : true,
      )
      .slice(0, 8);
  }, [all.data, query, assigned]);

  const inputClass =
    "w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-muted-foreground focus:border-primary";

  return (
    <Panel
      title="Assigned properties"
      aside={
        <button
          onClick={() => setPicking((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-md border border-input px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-brand-tint"
        >
          <Plus className="size-3.5" /> Assign property
        </button>
      }
    >
      {assigned.length === 0 ? (
        <p className="py-3 text-sm text-muted-foreground">No properties assigned</p>
      ) : (
        <div className="-mx-5">
          {assigned.map((a) => (
            <div
              key={a.linkId}
              className="flex items-center justify-between gap-3 border-b border-border px-5 py-3 last:border-b-0"
            >
              <Link
                to="/properties/$propertyId"
                params={{ propertyId: a.property.id }}
                className="min-w-0 hover:underline"
              >
                <span className="block truncate text-sm font-medium text-ink">
                  {a.property.address}
                </span>
                <span className="block truncate font-mono text-[11px] text-muted-foreground">
                  {a.property.postcode ?? "No postcode"}
                </span>
              </Link>
              <button
                onClick={() => remove.mutate(a.linkId)}
                disabled={remove.isPending}
                aria-label={`Remove ${a.property.address}`}
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
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search properties by address or postcode"
              className={`${inputClass} pl-8`}
            />
          </div>
          <div className="mt-2 max-h-44 overflow-y-auto rounded-md border border-border">
            {all.isLoading ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">Loading…</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-3 text-xs text-muted-foreground">No matches.</p>
            ) : (
              results.map((p) => (
                <button
                  key={p.id}
                  onClick={() => assign.mutate(p.id)}
                  disabled={assign.isPending}
                  className="block w-full border-b border-border px-3 py-2 text-left text-sm text-ink transition-colors last:border-b-0 hover:bg-brand-tint"
                >
                  <span className="block truncate">{p.address}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.postcode ?? "No postcode"}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </Panel>
  );
}
