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
    mutationFn: (vars: { response: "accepted" | "declined"; appointmentAt?: string }) =>
      setContractorResponse({
        data: { caseId: caseRecord.id, response: vars.response, appointmentAt: vars.appointmentAt },
      }),
    onSuccess: async () => {
      setConfirmOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["maintenance_cases", caseRecord.id] });
    },
  });

  const assigned = caseRecord.contractor;
  const responseStatus = caseRecord.contractor_response_status;
  const appointmentAt = (caseRecord as { appointment_at?: string | null }).appointment_at ?? null;

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
          {responseStatus && (
            <div className="mt-3">
              <span
                className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                  responseStyles[responseStatus] ?? responseStyles.pending
                }`}
              >
                {responseLabels[responseStatus] ?? responseStatus}
              </span>
              {caseRecord.contractor_responded_at && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Responded {new Date(caseRecord.contractor_responded_at).toLocaleString("en-GB")}
                </p>
              )}
            </div>
          )}
          {appointmentAt && (
            <p className="mt-2 text-xs text-muted-foreground">
              Appointment: {new Date(appointmentAt).toLocaleString("en-GB")}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={responseMutation.isPending}
              onClick={() => setConfirmOpen(true)}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-ink hover:border-primary hover:bg-brand-tint disabled:opacity-50"
            >
              Accept job
            </button>
            <button
              type="button"
              disabled={responseMutation.isPending || responseStatus === "declined"}
              onClick={() => responseMutation.mutate({ response: "declined" })}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-destructive hover:border-destructive disabled:opacity-50"
            >
              Can't take job
            </button>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Internal test actions — contractor SMS links are not live yet.
          </p>
          {responseMutation.isError && (
            <p className="mt-1 text-xs text-destructive">
              {(responseMutation.error as Error).message}
            </p>
          )}

          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Confirm appointment</DialogTitle>
                <DialogDescription>
                  Set the date and time the contractor will attend. They receive a confirmation
                  SMS.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!date || !time) return;
                  const when = new Date(`${date}T${time}`);
                  if (Number.isNaN(when.getTime())) return;
                  responseMutation.mutate({
                    response: "accepted",
                    appointmentAt: when.toISOString(),
                  });
                }}
                className="space-y-3"
              >
                <div>
                  <label className={labelClass} htmlFor="appointment-date">
                    Appointment date
                  </label>
                  <input
                    id="appointment-date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass} htmlFor="appointment-time">
                    Appointment time
                  </label>
                  <input
                    id="appointment-time"
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <DialogFooter>
                  <button
                    type="submit"
                    disabled={responseMutation.isPending || !date || !time}
                    className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                  >
                    {responseMutation.isPending ? "Confirming…" : "Confirm Job"}
                  </button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      ) : (
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
