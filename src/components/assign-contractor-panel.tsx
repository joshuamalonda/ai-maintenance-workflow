import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  assignCaseContractor,
  setContractorResponse,
  listPropertyContractorsForCase,
  type CaseDetail,
} from "@/lib/cases.functions";

const responseLabels: Record<string, string> = {
  pending: "Awaiting contractor response",
  accepted: "Contractor accepted",
  declined: "Contractor declined",
};

const responseStyles: Record<string, string> = {
  pending: "border-high/25 bg-high/8 text-high",
  accepted: "border-primary/30 bg-brand-tint text-accent-foreground",
  declined: "border-destructive/30 bg-destructive/8 text-destructive",
};

export function AssignContractorPanel({ caseRecord }: { caseRecord: CaseDetail }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const propertyId = caseRecord.property?.id ?? null;

  const { data: contractors = [], isLoading } = useQuery({
    queryKey: ["property-contractors", propertyId],
    queryFn: () => listPropertyContractorsForCase({ data: { propertyId: propertyId! } }),
    enabled: open && Boolean(propertyId),
  });

  const mutation = useMutation({
    mutationFn: (contractorId: string | null) =>
      assignCaseContractor({ data: { caseId: caseRecord.id, contractorId } }),
    onSuccess: async () => {
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["maintenance_cases", caseRecord.id] });
    },
  });

  const responseMutation = useMutation({
    mutationFn: (response: "accepted" | "declined") =>
      setContractorResponse({ data: { caseId: caseRecord.id, response } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["maintenance_cases", caseRecord.id] });
    },
  });

  const assigned = caseRecord.contractor;
  const responseStatus = caseRecord.contractor_response_status;

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">Assigned contractor</h2>
        {propertyId && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs font-medium text-primary hover:underline"
          >
            {open ? "Cancel" : assigned ? "Change" : "Assign contractor"}
          </button>
        )}
      </div>

      {!propertyId ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Link this case to a property before assigning a contractor.
        </p>
      ) : assigned ? (
        <div className="mt-2">
          <p className="text-sm text-ink">
            <Link
              to="/contractors/$contractorId"
              params={{ contractorId: assigned.id }}
              className="text-primary hover:underline"
            >
              {assigned.name}
            </Link>
            {assigned.company ? ` · ${assigned.company}` : ""}
            {assigned.trade ? ` · ${assigned.trade}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {[assigned.phone, assigned.email].filter(Boolean).join(" · ")}
            {caseRecord.assigned_at
              ? ` · assigned ${new Date(caseRecord.assigned_at).toLocaleString("en-GB")}`
              : ""}
          </p>
        </div>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          No contractor is assigned to this case yet.
        </p>
      )}

      {open && propertyId && (
        <div className="mt-3 space-y-2">
          {isLoading ? (
            <p className="text-xs text-muted-foreground">Loading contractors…</p>
          ) : contractors.length === 0 ? (
            <div className="rounded-md border border-border px-3 py-3">
              <p className="text-xs text-muted-foreground">
                No contractors are assigned to this property.
              </p>
              <Link
                to="/properties/$propertyId"
                params={{ propertyId }}
                className="mt-2 inline-block text-xs font-medium text-primary hover:underline"
              >
                Manage contractors on this property →
              </Link>
            </div>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {contractors.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    disabled={mutation.isPending}
                    onClick={() => mutation.mutate(c.id)}
                    className="w-full rounded-md border border-border px-3 py-2 text-left text-sm text-ink hover:border-primary hover:bg-brand-tint disabled:opacity-60"
                  >
                    <span className="block truncate font-medium">
                      {c.name}
                      {c.active ? "" : " (inactive)"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[c.company, c.trade, c.phone].filter(Boolean).join(" · ") || "No details"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {assigned && (
            <button
              type="button"
              disabled={mutation.isPending}
              onClick={() => mutation.mutate(null)}
              className="text-xs font-medium text-destructive hover:underline"
            >
              Remove assignment
            </button>
          )}
          {mutation.isError && (
            <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>
          )}
        </div>
      )}
    </div>
  );
}
