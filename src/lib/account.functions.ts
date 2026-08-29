import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toE164, isValidE164 } from "@/lib/phone";

export type AgencyAccount = {
  id: string;
  name: string;
  slug: string;
  notification_phone: string | null;
};

/** The agency the signed-in user belongs to, with its notification settings. */
export const getAgencyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("agencies")
      .select("id, name, slug, notification_phone")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? null) as AgencyAccount | null;
  });

/**
 * Saves (or clears) the agency notification mobile number. RLS restricts the
 * update to agencies the caller is a member of.
 */
export const setAgencyNotificationPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ agencyId: z.string().uuid(), phone: z.string().nullable() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    let phone: string | null = null;
    if (data.phone && data.phone.trim()) {
      phone = toE164(data.phone);
      if (!phone || !isValidE164(phone)) throw new Error("Enter a valid mobile number");
    }

    const { data: row, error } = await context.supabase
      .from("agencies")
      .update({ notification_phone: phone })
      .eq("id", data.agencyId)
      .select("id, name, slug, notification_phone")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Agency not found");
    return row as AgencyAccount;
  });

// ---------------------------------------------------------------------------
// Communications — the agency's voice number and its SMS number.
//
// These are two SEPARATE resources:
//   channel = 'phone' -> local Telnyx voice number, inbound tenant calls only.
//   channel = 'sms'   -> SMS-capable mobile (+447...), outbound SMS sender only.
//
// `channel_endpoints` is the single source of truth for communication
// identity. The agency is always derived server-side from the caller's
// membership; never from browser input.
// ---------------------------------------------------------------------------

export type AgencyCommunications = {
  agencyId: string;
  /** Local Telnyx voice number in E.164 (inbound calls), or null. */
  voiceNumber: string | null;
  voiceEndpointId: string | null;
  /** SMS-capable mobile in E.164 (outbound SMS sender), or null. */
  smsNumber: string | null;
  smsEndpointId: string | null;
  /** WhatsApp business sender: phone-number ID or E.164 sender, or null. */
  whatsappSender: string | null;
  whatsappEndpointId: string | null;
};


/** Resolves the caller's agency through their membership. */
async function currentAgencyId(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("agency_members")
    .select("agency_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Your account is not linked to an agency.");
  return (data as { agency_id: string }).agency_id;
}

type EndpointChannel = "phone" | "sms" | "whatsapp";

async function readCommunications(agencyId: string): Promise<AgencyCommunications> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("channel_endpoints")
    .select("id, identifier, channel")
    .eq("agency_id", agencyId)
    .in("channel", ["phone", "sms", "whatsapp"])
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<{ id: string; identifier: string; channel: string }>;
  const voice = rows.find((r) => r.channel === "phone") ?? null;
  const sms = rows.find((r) => r.channel === "sms") ?? null;
  const whatsapp = rows.find((r) => r.channel === "whatsapp") ?? null;
  return {
    agencyId,
    voiceNumber: voice?.identifier ?? null,
    voiceEndpointId: voice?.id ?? null,
    smsNumber: sms?.identifier ?? null,
    smsEndpointId: sms?.id ?? null,
    whatsappSender: whatsapp?.identifier ?? null,
    whatsappEndpointId: whatsapp?.id ?? null,
  };

}

/** The agency's voice + SMS numbers, scoped by membership. */
export const getAgencyCommunications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const agencyId = await currentAgencyId(context.supabase as never, context.userId);
    return await readCommunications(agencyId);
  });

/**
 * Registers (or replaces) one of the agency's numbers. A number actively
 * assigned to another agency on the same channel can never be claimed.
 * Replacing a number deactivates the previous endpoint rather than deleting
 * it, preserving the historical mapping for past cases.
 */
async function registerEndpoint(
  agencyId: string,
  channel: EndpointChannel,
  rawPhone: string,
): Promise<AgencyCommunications> {
  let normalised: string;
  if (channel === "whatsapp") {
    // A WhatsApp sender is either a Meta business phone-number ID (digits
    // only) or the business number in E.164 — both are accepted verbatim.
    const raw = rawPhone.trim();
    const digits = raw.replace(/[^0-9]/g, "");
    if (digits.length < 6 || digits.length > 25) {
      throw new Error(
        "Enter the WhatsApp business phone-number ID (digits) or the business number in international format.",
      );
    }
    normalised = raw.startsWith("+") ? `+${digits}` : digits;
  } else {
    const phone = toE164(rawPhone);
    if (!phone || !isValidE164(phone)) {
      throw new Error("Enter a valid number in international format, e.g. +441137336198.");
    }
    normalised = phone.startsWith("+") ? phone : `+${phone}`;
  }

  const { identifierKey } = await import("@/lib/agency.server");
  const key = identifierKey(normalised);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // A voice number is voice-only and an SMS number is SMS-only: the same
  // number must never be registered for both roles.
  const current = await readCommunications(agencyId);
  const other =
    channel === "phone" ? current.smsNumber : channel === "sms" ? current.voiceNumber : null;
  if (other && identifierKey(other) === key) {
    throw new Error(
      channel === "phone"
        ? "This number is already set as the agency SMS number. The voice number must be a different, separate number."
        : "This number is already set as the agency voice number. Local voice numbers cannot send SMS — use a separate SMS-capable mobile (+447...).",
    );
  }


  // Ownership check across all agencies — deliberately admin-scoped, since a
  // member cannot (and must not) read another agency's endpoints.
  const { data: existing, error: lookupError } = await supabaseAdmin
    .from("channel_endpoints")
    .select("id, agency_id, is_active, channel")
    .eq("identifier_key", key)
    .eq("channel", channel);
  if (lookupError) throw new Error(lookupError.message);

  const claimedElsewhere = (existing ?? []).find(
    (row) => row.is_active && row.agency_id !== agencyId,
  );
  if (claimedElsewhere) {
    throw new Error("This number is already assigned to another agency.");
  }

  // Deactivate any other active endpoint of this channel for this agency.
  const { error: deactivateError } = await supabaseAdmin
    .from("channel_endpoints")
    .update({ is_active: false })
    .eq("agency_id", agencyId)
    .eq("channel", channel)
    .eq("is_active", true)
    .neq("identifier_key", key);
  if (deactivateError) throw new Error(deactivateError.message);

  const mine = (existing ?? []).find((row) => row.agency_id === agencyId);
  const label = channel === "phone" ? "Agency voice number" : "Agency SMS number";

  if (mine) {
    const { error } = await supabaseAdmin
      .from("channel_endpoints")
      .update({ identifier: normalised, is_active: true, label })
      .eq("id", mine.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabaseAdmin.from("channel_endpoints").insert({
      agency_id: agencyId,
      channel,
      identifier: normalised,
      identifier_key: key,
      label,
      is_active: true,
    } as never);
    if (error) throw new Error(error.message);
  }

  return await readCommunications(agencyId);
}

/** Sets the agency's inbound voice number (local Telnyx number, calls only). */
export const setAgencyVoiceNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ phone: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const agencyId = await currentAgencyId(context.supabase as never, context.userId);
    return await registerEndpoint(agencyId, "phone", data.phone);
  });

/** Sets the agency's outbound SMS sender number (SMS-capable mobile). */
export const setAgencySmsNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ phone: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const agencyId = await currentAgencyId(context.supabase as never, context.userId);
    return await registerEndpoint(agencyId, "sms", data.phone);
  });

