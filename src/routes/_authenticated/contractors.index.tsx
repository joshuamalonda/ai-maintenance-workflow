import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { listAgencyContractors } from "@/lib/contractors.functions";
import { ContractorFormDialog } from "@/components/contractor-form-dialog";

const contractorsQuery = queryOptions({
  queryKey: ["contractors"],
  queryFn: () => listAgencyContractors(),
});

export const Route = createFileRoute("/_authenticated/contractors/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(contractorsQuery);
  },
  head: () => ({
    meta: [
      { title: "Contractors — Ovelo" },
      {
        name: "description",
        content:
          "Your agency's contractor directory: trades, contact details and the properties each contractor covers.",
      },
      { property: "og:title", content: "Contractors — Ovelo" },
      {
        property: "og:description",
        content: "Manage contractors and the properties they are assigned to in Ovelo.",
      },
    ],
  }),
  component: ContractorsPage,
});

function ActivePill({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
        active ? "bg-brand-tint text-primary" : "bg-secondary text-muted-foreground"
      }`}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function ContractorsPage() {
  const { data: contractors } = useSuspenseQuery(contractorsQuery);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contractors;
    return contractors.filter((c) =>
      [c.name, c.company ?? "", c.trade ?? ""].join(" ").toLowerCase().includes(q),
    );
  }, [contractors, query]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-3xl">Contractors</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            The trades your agency works with, and the properties each one covers.
          </p>
        </div>
        <ContractorFormDialog
          trigger={
            <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground">
              <Plus className="size-4" /> Add contractor
            </button>
          }
        />
      </header>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by contact name, company or trade"
        className="mb-4 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-ink outline-none placeholder:text-muted-foreground focus:border-primary"
      />

      <div className="overflow-hidden rounded-md border border-border bg-surface">
        <div className="hidden grid-cols-[1.3fr_1.2fr_1fr_1fr_6rem] gap-3 border-b border-border bg-secondary px-5 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground lg:grid">
          <span>Contact</span>
          <span>Company</span>
          <span>Trade</span>
          <span>Phone</span>
          <span>Status</span>
        </div>
        {rows.length === 0 ? (
          <div className="px-5 py-10">
            <p className="text-sm font-medium text-ink">
              {contractors.length === 0
                ? "No contractors yet"
                : "No contractors match your search"}
            </p>
            <p className="mt-1.5 max-w-xl text-sm text-muted-foreground">
              {contractors.length === 0
                ? "Add the trades your agency uses so they can be assigned to properties."
                : "Try a different name, company or trade."}
            </p>
          </div>
        ) : (
          rows.map((c) => (
            <Link
              key={c.id}
              to="/contractors/$contractorId"
              params={{ contractorId: c.id }}
              className="grid gap-2 border-b border-border px-5 py-3.5 text-sm transition-colors last:border-b-0 hover:bg-brand-tint lg:grid-cols-[1.3fr_1.2fr_1fr_1fr_6rem] lg:items-center lg:gap-3"
            >
              <span className="truncate font-medium text-ink">{c.name}</span>
              <span className="truncate text-muted-foreground">{c.company ?? "—"}</span>
              <span className="truncate text-muted-foreground">{c.trade ?? "—"}</span>
              <span className="truncate font-mono text-[11px] text-muted-foreground">
                {c.phone ?? "—"}
              </span>
              <ActivePill active={c.active} />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
