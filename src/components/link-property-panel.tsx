import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { listProperties } from "@/lib/properties.functions";
import { linkCaseToProperty, type CaseDetail } from "@/lib/cases.functions";

const inputClass =
  "w-full rounded-md border border-input bg-surface py-2 pl-8 pr-3 text-sm text-ink outline-none placeholder:text-muted-foreground focus:border-primary";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b border-border py-3 last:border-b-0">
      <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-ink">{value}</dd>
    </div>
  );
}

export function LinkedPropertyPanel({ caseRecord }: { caseRecord: CaseDetail }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const linked = caseRecord.property;

  const { data: properties = [] } = useQuery({
    queryKey: ["properties"],
    queryFn: () => listProperties(),
    enabled: open,
  });

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? properties.filter((p) =>
          [p.address, p.postcode ?? ""].join(" ").toLowerCase().includes(q),
        )
      : properties;
    return list.slice(0, 8);
  }, [properties, query]);

  const mutation = useMutation({
    mutationFn: (propertyId: string | null) =>
      linkCaseToProperty({ data: { caseId: caseRecord.id, propertyId } }),
    onSuccess: async () => {
      setOpen(false);
      setQuery("");
      await queryClient.invalidateQueries({ queryKey: ["maintenance_cases", caseRecord.id] });
    },
  });

  const tenant = linked?.tenant ?? caseRecord.linked_tenant;
  const landlord = linked?.landlord ?? null;

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Linked property</h2>
        {linked ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {open ? "Cancel" : "Change"}
          </button>
        ) : null}
      </div>

      {linked ? (
        <dl className="mt-2">
          <Row
            label="Property address"
            value={
              <Link
                to="/properties/$propertyId"
                params={{ propertyId: linked.id }}
                className="text-primary hover:underline"
              >
                {linked.address}
                {linked.postcode ? `, ${linked.postcode}` : ""}
              </Link>
            }
          />
          <Row
            label="Tenant"
            value={
              tenant
                ? [tenant.name, tenant.phone, tenant.email].filter(Boolean).join(" · ")
                : "No tenant recorded on this property"
            }
          />
          <Row
            label="Landlord"
            value={
              landlord
                ? [landlord.name, landlord.phone, landlord.email].filter(Boolean).join(" · ")
                : "No landlord recorded on this property"
            }
          />
          {caseRecord.contractor && (
            <Row
              label="Assigned contractor"
              value={[
                caseRecord.contractor.name,
                caseRecord.contractor.company,
                caseRecord.contractor.trade,
              ]
                .filter(Boolean)
                .join(" · ")}
            />
          )}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          This case isn't linked to a property in your directory yet.
        </p>
      )}

      {!linked && !open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Link to property
        </button>
      )}

      {open && (
        <div className="mt-3 space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              className={inputClass}
              placeholder="Search address or postcode"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
          </div>
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {results.length === 0 && (
              <li className="px-1 py-2 text-xs text-muted-foreground">No properties found.</li>
            )}
            {results.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={mutation.isPending}
                  onClick={() => mutation.mutate(p.id)}
                  className="w-full rounded-md border border-border px-3 py-2 text-left text-sm text-ink hover:border-primary hover:bg-brand-tint disabled:opacity-60"
                >
                  <span className="block truncate font-medium">{p.address}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[p.postcode, p.tenant?.name].filter(Boolean).join(" · ") || "No tenant"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {linked && (
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(null)}
              className="text-xs font-medium text-destructive hover:underline"
            >
              Unlink property
            </button>
          )}
          {mutation.isError && (
            <p className="text-xs text-destructive">
              {(mutation.error as Error).message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
