import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { listProperties } from "@/lib/properties.functions";
import { PropertyFormDialog } from "@/components/property-form-dialog";

const propertiesQuery = queryOptions({
  queryKey: ["properties"],
  queryFn: () => listProperties(),
});

export const Route = createFileRoute("/_authenticated/properties/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(propertiesQuery);
  },
  head: () => ({
    meta: [
      { title: "Properties — Ovelo" },
      {
        name: "description",
        content:
          "The property directory for your letting agency: addresses, landlords, tenants and assigned contractors.",
      },
      { property: "og:title", content: "Properties — Ovelo" },
      {
        property: "og:description",
        content: "Manage the properties, landlords and tenants your agency looks after in Ovelo.",
      },
    ],
  }),
  component: PropertiesPage,
});

function PropertiesPage() {
  const { data: properties } = useSuspenseQuery(propertiesQuery);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter((p) =>
      [p.address, p.postcode ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [properties, query]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Properties</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Every property your agency manages, with its landlord and current tenant.
          </p>
        </div>
        <PropertyFormDialog
          trigger={
            <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground">
              <Plus className="size-4" /> Add property
            </button>
          }
        />
      </header>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by address or postcode"
        className="mb-4 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-muted-foreground focus:border-primary"
      />

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <div className="hidden grid-cols-[1.6fr_7rem_1fr_1fr] gap-3 border-b border-border bg-secondary px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:grid">
          <span>Address</span>
          <span>Postcode</span>
          <span>Landlord</span>
          <span>Tenant</span>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-10">
            <p className="text-sm font-medium text-ink">
              {properties.length === 0 ? "No properties yet" : "No properties match your search"}
            </p>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              {properties.length === 0
                ? "Add the first property your agency manages to start building the directory."
                : "Try a different address or postcode."}
            </p>
          </div>
        ) : (
          rows.map((p) => (
            <Link
              key={p.id}
              to="/properties/$propertyId"
              params={{ propertyId: p.id }}
              className="grid gap-2 border-b border-border px-5 py-3.5 text-sm transition-colors last:border-b-0 hover:bg-brand-tint lg:grid-cols-[1.6fr_7rem_1fr_1fr] lg:items-center lg:gap-3"
            >
              <span className="truncate font-medium text-ink">{p.address}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {p.postcode ?? "—"}
              </span>
              <span className="truncate text-muted-foreground">{p.landlord?.name ?? "—"}</span>
              <span className="truncate text-muted-foreground">{p.tenant?.name ?? "—"}</span>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
