// Server-only: resolves the destination communication endpoint of an inbound
// conversation to the agency that owns it.
//
//   destination endpoint -> channel_endpoints -> agency_id -> maintenance_case
//
// The destination is NEVER the tenant's number. For phone calls it is the
// Telnyx `telnyx_agent_target` (the Ovelo DID the tenant dialled); for
// WhatsApp it is the business sender the tenant messaged.

const TELNYX_API = "https://api.telnyx.com/v2";

/** Canonical comparison key for a phone number / WhatsApp sender. */
export function identifierKey(value: string): string {
  const digits = value.replace(/[^0-9]/g, "");
  return digits.length > 0 ? digits : value.trim().toLowerCase();
}

export type ResolvedEndpoint = {
  endpointId: string;
  agencyId: string;
  channel: "phone" | "whatsapp";
  identifier: string;
};

/**
 * Looks up the Telnyx conversation for a live/just-ended call and returns the
 * verified destination number (`telnyx_agent_target`). This is a trusted
 * server-side read: it never relies on a value supplied by the AI assistant.
 */
export async function fetchTelnyxAgentTarget(
  callControlId: string,
  apiKey: string,
): Promise<string | null> {
  try {
    const response = await fetch(`${TELNYX_API}/ai/conversations?page[size]=100`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      data?: Array<{ metadata?: Record<string, unknown> | null }>;
    };
    for (const conversation of payload.data ?? []) {
      const meta = conversation.metadata ?? {};
      if (meta["call_control_id"] !== callControlId) continue;
      const target = meta["telnyx_agent_target"] ?? meta["to"];
      return typeof target === "string" && target.length > 0 ? target : null;
    }
  } catch (error) {
    console.error("[agency] telnyx agent target lookup failed", error);
  }
  return null;
}

/** Resolves an endpoint identifier to its owning agency. Never defaults. */
export async function resolveEndpointAgency(
  identifier: string,
): Promise<ResolvedEndpoint | null> {
  const key = identifierKey(identifier);
  if (!key) return null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("channel_endpoints")
    .select("id, agency_id, channel, identifier")
    .eq("identifier_key", key)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("[agency] endpoint lookup failed", error.message);
    return null;
  }
  if (!data) return null;
  return {
    endpointId: data.id,
    agencyId: data.agency_id,
    channel: data.channel as "phone" | "whatsapp",
    identifier: data.identifier,
  };
}
