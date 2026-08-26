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

    await trySend(
      "tenant",
      row.tenant?.phone ?? null,
      `Your maintenance request has been logged. Reference ${ref}. We'll be in touch.`,
    );
    await trySend(
      "landlord",
      row.landlord?.phone ?? null,
      `A maintenance request has been logged for ${address}. Reference ${ref}.`,
    );
  } catch (err) {
    console.error("[case-notifications] unexpected failure", err);
  }
}
