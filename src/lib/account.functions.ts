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
// Communications — the agency's dedicated Ovelo number.
//
// `channel_endpoints` is the single source of truth for communication
// identity: inbound calls resolve the owning agency from the called number,
// and outbound SMS is sent from the same number. The agency is always derived
// server-side from the caller's membership; never from browser input.
// ---------------------------------------------------------------------------

export type AgencyCommunications = {
  agencyId: string;
  /** Assigned Ovelo number in E.164, or null when not configured. */
  phoneNumber: string | null;
  endpointId: string | null;
  label: string | null;
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

/** The agency's active phone endpoint, scoped by membership + RLS. */
export const getAgencyCommunications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const agencyId = await currentAgencyId(context.supabase as never, context.userId);
    const { data, error } = await context.supabase
      .from("channel_endpoints")
      .select("id, identifier, label")
      .eq("agency_id", agencyId)
      .eq("channel", "phone")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return {
      agencyId,
      phoneNumber: data ? (data as { identifier: string }).identifier : null,
      endpointId: data ? (data as { id: string }).id : null,
      label: data ? ((data as { label: string | null }).label ?? null) : null,
    } satisfies AgencyCommunications;
  });

/**
 * Assigns (or replaces) the agency's dedicated Ovelo number. A number actively
 * assigned to another agency can never be claimed. Replacing a number
 * deactivates the previous endpoint rather than deleting it, preserving the
 * historical mapping for past cases.
 */
export const setAgencyPhoneNumber = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ phone: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const agencyId = await currentAgencyId(context.supabase as never, context.userId);

    const phone = toE164(data.phone);
    if (!phone || !isValidE164(phone)) throw new Error("Enter a valid number in international format, e.g. +441137336198.");
    const normalised = phone.startsWith("+") ? phone : `+${phone}`;

    const { identifierKey } = await import("@/lib/agency.server");
    const key = identifierKey(normalised);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Ownership check across all agencies — deliberately admin-scoped, since a
    // member cannot (and must not) read another agency's endpoints.
    const { data: existing, error: lookupError } = await supabaseAdmin
      .from("channel_endpoints")
      .select("id, agency_id, is_active, channel")
      .eq("identifier_key", key)
      .eq("channel", "phone");
    if (lookupError) throw new Error(lookupError.message);

    const claimedElsewhere = (existing ?? []).find(
      (row) => row.is_active && row.agency_id !== agencyId,
    );
    if (claimedElsewhere) {
      throw new Error("This number is already assigned to another agency.");
    }

    // Deactivate any other active phone endpoint for this agency.
    const { error: deactivateError } = await supabaseAdmin
      .from("channel_endpoints")
      .update({ is_active: false })
      .eq("agency_id", agencyId)
      .eq("channel", "phone")
      .eq("is_active", true)
      .neq("identifier_key", key);
    if (deactivateError) throw new Error(deactivateError.message);

    const mine = (existing ?? []).find((row) => row.agency_id === agencyId);
    const label = "Agency Ovelo number";

    if (mine) {
      const { error } = await supabaseAdmin
        .from("channel_endpoints")
        .update({ identifier: normalised, is_active: true, label })
        .eq("id", mine.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("channel_endpoints").insert({
        agency_id: agencyId,
        channel: "phone",
        identifier: normalised,
        identifier_key: key,
        label,
        is_active: true,
      } as never);
      if (error) throw new Error(error.message);
    }

    const { data: row, error: readError } = await supabaseAdmin
      .from("channel_endpoints")
      .select("id, identifier, label")
      .eq("agency_id", agencyId)
      .eq("channel", "phone")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (readError) throw new Error(readError.message);

    return {
      agencyId,
      phoneNumber: row ? (row as { identifier: string }).identifier : normalised,
      endpointId: row ? (row as { id: string }).id : null,
      label,
    } satisfies AgencyCommunications;
  });
