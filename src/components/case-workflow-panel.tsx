import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  openCaseAndNotify,
  setCaseStatus,
  setLandlordDecision,
  type CaseDetail,
} from "@/lib/cases.functions";
import { statusLabels } from "@/components/case-badges";

const statuses = ["needs_attention", "in_progress", "completed"] as const;
type Status = (typeof statuses)[number];

const decisionLabels: Record<string, string> = {
  landlord_handling: "Landlord is handling this themselves",
  contractor: "Send a contractor",
};

/**
 * The agency's control surface for a case: the explicit notify gate, the
 * landlord's decision, and the workflow status. Every action is a verified
 * server function; SMS side effects are best-effort server-side.
 */
export function CaseWorkflowPanel({ caseRecord }: { caseRecord: CaseDetail }) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["maintenance_cases"] });

  const record = caseRecord as CaseDetail & {
    case_created_notified_at?: string | null;
    landlord_decision?: string | null;
    landlord_decision_at?: string | null;
  };

  const openMutation = useMutation({
    mutationFn: () => openCaseAndNotify({ data: { caseId: caseRecord.id } }),
    onSuccess: invalidate,
  });

  const decisionMutation = useMutation({
    mutationFn: (decision: "landlord_handling" | "contractor" | null) =>
      setLandlordDecision({ data: { caseId: caseRecord.id, decision } }),
    onSuccess: invalidate,
  });

  const statusMutation = useMutation({
    mutationFn: (status: Status) => setCaseStatus({ data: { caseId: caseRecord.id, status } }),
    onSuccess: invalidate,
  });

  const notified = Boolean(record.case_created_notified_at);
  const hasProperty = Boolean(caseRecord.property_id);
  const decision = record.landlord_decision ?? null;
  const busy =
    openMutation.isPending || decisionMutation.isPending || statusMutation.isPending;

  const error =
    (openMutation.error as Error | null)?.message ??
    (decisionMutation.error as Error | null)?.message ??
    (statusMutation.error as Error | null)?.message ??
    null;

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <h2 className="text-sm font-semibold text-ink">Case workflow</h2>

      {/* 1. Review gate ------------------------------------------------- */}
      <div className="mt-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Tenant &amp; landlord notification
        </p>
        {notified ? (
          <p className="mt-1 text-sm text-ink">
            Sent {new Date(record.case_created_notified_at as string).toLocaleString("en-GB")}
          </p>
        ) : (
          <>
            <button
              type="button"
              disabled={busy || !hasProperty}
              onClick={() => openMutation.mutate()}
              className="mt-2 w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {openMutation.isPending ? "Sending…" : "Open case & notify"}
            </button>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {hasProperty
                ? "Texts the tenant and landlord once. Nothing is sent until you do this."
                : "Link this case to a property first — that's where the verified numbers come from."}
            </p>
          </>
        )}
      </div>

      {/* 2. Landlord decision -------------------------------------------- */}
      <div className="mt-4 border-t border-border pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Landlord decision
        </p>
        {decision ? (
          <div className="mt-1">
            <p className="text-sm text-ink">{decisionLabels[decision] ?? decision}</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => decisionMutation.mutate(null)}
              className="mt-1 text-xs font-medium text-primary hover:underline disabled:opacity-50"
            >
              Clear decision
            </button>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => decisionMutation.mutate("contractor")}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-ink hover:border-primary hover:bg-brand-tint disabled:opacity-50"
            >
              Send contractor
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => decisionMutation.mutate("landlord_handling")}
              className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-ink hover:border-primary hover:bg-brand-tint disabled:opacity-50"
            >
              Landlord handling
            </button>
          </div>
        )}
      </div>

      {/* 3. Status -------------------------------------------------------- */}
      <div className="mt-4 border-t border-border pt-4">
        <label
          htmlFor="case-status"
          className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground"
        >
          Status
        </label>
        <select
          id="case-status"
          value={caseRecord.status}
          disabled={busy}
          onChange={(e) => statusMutation.mutate(e.target.value as Status)}
          className="mt-1.5 w-full rounded-md border border-input bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary disabled:opacity-50"
        >
          {statuses.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s] ?? s}
            </option>
          ))}
        </select>
        {caseRecord.status !== "completed" && (
          <button
            type="button"
            disabled={busy}
            onClick={() => statusMutation.mutate("completed")}
            className="mt-2 w-full rounded-md border border-border px-3 py-2 text-sm font-medium text-ink hover:border-primary hover:bg-brand-tint disabled:opacity-50"
          >
            Mark job complete
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
    </div>
  );
}
