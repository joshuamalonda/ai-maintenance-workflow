// Server-only: best-effort transactional SMS on successful case creation.
// Never throws into the intake path — every failure is logged and swallowed.

import { sendTelnyxSms, isValidE164 } from "./telnyx-sms.server";

export type NotifyCaseCreatedInput = {
  agencyId: string;
  propertyId: string;
  referenceCode: string;
  propertyAddress: string | null;
};

/**
 * Directory numbers are typed by agency staff, commonly in UK national form
 * ("07726 730729"). Convert those to E.164 so they are not silently skipped.
 * Anything already international, or not recognisably UK, is left untouched.
 */
export function toE164(raw: string | null | undefined): string | null {
  const value = (raw ?? "").replace(/[\s()-]/g, "").trim();
  if (!value) return null;
  if (value.startsWith("+")) return value;
  if (/^07\d{9}$/.test(value)) return `+44${value.slice(1)}`;
  if (/^447\d{9}$/.test(value)) return `+${value}`;
  if (/^00447\d{9}$/.test(value)) return `+${value.slice(2)}`;
  return value;
}

async function trySend(label: string, phone: string | null, body: string) {
  const to = toE164(phone);
  if (!to || !isValidE164(to)) return;
  const result = await sendTelnyxSms(to, body);
  if ("error" in result) {
    console.error(`[case-notifications] ${label} SMS failed`, result.error, result.detail);
  }
}

/**
 * Sends the tenant and landlord confirmation SMS for a newly created case.
 * Only fires when the case matched a directory property, since that is the
 * only source of verified contact numbers.
 */
export async function notifyCaseCreated(input: NotifyCaseCreatedInput): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: property, error } = await supabaseAdmin
      .from("properties")
      .select("id, address, tenant:tenants(phone), landlord:landlords(phone)")
      .eq("id", input.propertyId)
      .eq("agency_id", input.agencyId)
      .maybeSingle();
    if (error || !property) return;

    const row = property as unknown as {
      address: string | null;
      tenant: { phone: string | null } | null;
      landlord: { phone: string | null } | null;
    };

    const address = row.address ?? input.propertyAddress ?? "your property";
    const ref = input.referenceCode;

    // Fetch the case issue for the landlord SMS. Best-effort: a lookup failure
    // falls back to a generic summary so the notification still sends.
    let issueSummary = "maintenance issue";
    try {
      const { data: caseRow } = await supabaseAdmin
        .from("maintenance_cases")
        .select("ai_summary, issue_description, issue_category")
        .eq("reference_code", ref)
        .eq("agency_id", input.agencyId)
        .maybeSingle();
      if (caseRow) {
        const c = caseRow as {
          ai_summary: string | null;
          issue_description: string | null;
          issue_category: string | null;
        };
        issueSummary =
          (c.ai_summary ?? c.issue_description ?? c.issue_category ?? "maintenance issue")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 300) || "maintenance issue";
      }
    } catch {
      /* keep default summary */
    }

    await trySend(
      "tenant",
      row.tenant?.phone ?? null,
      `Your maintenance request has been logged. Reference ${ref}. We'll be in touch.`,
    );
    await trySend(
      "landlord",
      row.landlord?.phone ?? null,
      `Maintenance issue reported at ${address}. Ref: ${ref}. Issue: ${issueSummary}. A contractor can be assigned to resolve this. If you would like to handle the issue yourself, please contact the agency.`,
    );
  } catch (err) {
    console.error("[case-notifications] unexpected failure", err);
  }
}

export type NotifyContractorAssignedInput = {
  agencyId: string;
  caseId: string;
  contractorId: string;
};

/**
 * Sends the assigned contractor an SMS about the new job. Best-effort: any
 * failure (missing/invalid phone, Telnyx error) is logged and swallowed so a
 * notification problem can never fail or undo the assignment itself.
 */
export async function notifyContractorAssigned(
  input: NotifyContractorAssignedInput,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: contractor, error: contractorError } = await supabaseAdmin
      .from("contractors")
      .select("id, phone")
      .eq("id", input.contractorId)
      .eq("agency_id", input.agencyId)
      .maybeSingle();
    if (contractorError || !contractor) {
      console.error("[case-notifications] contractor lookup failed", contractorError);
      return;
    }

    const phone = toE164(contractor.phone);
    if (!phone || !isValidE164(phone)) {
      console.error(
        `[case-notifications] contractor ${input.contractorId} has no valid E.164 phone; SMS skipped`,
      );
      return;
    }

    const { data: caseRow, error: caseError } = await supabaseAdmin
      .from("maintenance_cases")
      .select("reference_code, property_address, issue_description, issue_category, ai_summary")
      .eq("id", input.caseId)
      .eq("agency_id", input.agencyId)
      .maybeSingle();
    if (caseError || !caseRow) {
      console.error("[case-notifications] case lookup failed", caseError);
      return;
    }

    const reference = caseRow.reference_code ?? input.caseId;
    const address = caseRow.property_address ?? "the property";
    const rawIssue =
      caseRow.ai_summary ?? caseRow.issue_description ?? caseRow.issue_category ?? "maintenance issue";
    const issue = rawIssue.replace(/\s+/g, " ").trim().slice(0, 300);

    await trySend(
      "contractor",
      phone,
      `New OVELO maintenance job ${reference}. ${address}. Issue: ${issue}. Please contact the agency to confirm you can handle this job.`,
    );
  } catch (err) {
    console.error("[case-notifications] contractor SMS unexpected failure", err);
  }
}

export type NotifyContractorAppointmentInput = {
  caseId: string;
  agencyId: string;
  contractorId: string;
  /** ISO timestamp of the confirmed appointment. */
  appointmentAt: string;
};

/**
 * Sends the assigned contractor the appointment confirmation SMS. Best-effort:
 * any failure is logged and swallowed so it can never undo the saved
 * acceptance/appointment.
 */
export async function notifyContractorAppointmentConfirmed(
  input: NotifyContractorAppointmentInput,
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: contractor, error: contractorError } = await supabaseAdmin
      .from("contractors")
      .select("id, phone")
      .eq("id", input.contractorId)
      .eq("agency_id", input.agencyId)
      .maybeSingle();
    if (contractorError || !contractor) {
      console.error("[case-notifications] contractor lookup failed", contractorError);
      return;
    }

    const phone = toE164(contractor.phone);
    if (!phone || !isValidE164(phone)) {
      console.error(
        `[case-notifications] contractor ${input.contractorId} has no valid E.164 phone; SMS skipped`,
      );
      return;
    }

    const { data: caseRow, error: caseError } = await supabaseAdmin
      .from("maintenance_cases")
      .select("reference_code, property_address, issue_description, issue_category, ai_summary")
      .eq("id", input.caseId)
      .eq("agency_id", input.agencyId)
      .maybeSingle();
    if (caseError || !caseRow) {
      console.error("[case-notifications] case lookup failed", caseError);
      return;
    }

    const reference = caseRow.reference_code ?? input.caseId;
    const address = caseRow.property_address ?? "the property";
    const rawIssue =
      caseRow.ai_summary ??
      caseRow.issue_description ??
      caseRow.issue_category ??
      "maintenance issue";
    const issue = rawIssue.replace(/\s+/g, " ").trim().slice(0, 300);

    const when = new Date(input.appointmentAt);
    const datePart = when.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Europe/London",
    });
    const timePart = when.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/London",
    });

    await trySend(
      "contractor",
      phone,
      `Job ${reference} confirmed. ${address}. Issue: ${issue}. Appointment: ${datePart} at ${timePart}. Please attend at the confirmed time.`,
    );
  } catch (err) {
    console.error("[case-notifications] contractor appointment SMS unexpected failure", err);
  }
}
