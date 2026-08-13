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

export type TelnyxCallContext = {
  conversationId: string | null;
  callControlId: string | null;
  agentTarget: string | null;
};

function metaString(meta: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

/**
 * Trusted server-side read of the Telnyx conversation behind a call. Matches
 * on `call_control_id` when available, otherwise falls back to the
 * `conversation_id` the assistant reported. Returns the verified destination
 * (`telnyx_agent_target`) plus the call control id for enrichment. Never
 * relies on a destination value supplied by the AI assistant.
 */
export async function fetchTelnyxCallContext(
  input: { callControlId?: string | null; conversationId?: string | null },
  apiKey: string,
): Promise<TelnyxCallContext | null> {
  const callControlId = input.callControlId ?? null;
  const conversationId = input.conversationId ?? null;
  if (!callControlId && !conversationId) return null;

  try {
    const response = await fetch(`${TELNYX_API}/ai/conversations?page[size]=100`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as {
      data?: Array<{ id?: string; metadata?: Record<string, unknown> | null }>;
    };
    for (const conversation of payload.data ?? []) {
      const meta = conversation.metadata ?? {};
      const metaControlId = metaString(meta, [
        "call_control_id",
        "telnyx_call_control_id",
        "telnyx_call_id",
      ]);
      const matches = callControlId
        ? metaControlId === callControlId
        : conversation.id === conversationId;
      if (!matches) continue;
      return {
        conversationId: conversation.id ?? conversationId,
        callControlId: callControlId ?? metaControlId,
        agentTarget: metaString(meta, ["telnyx_agent_target", "to", "destination_number"]),
      };
    }
  } catch (error) {
    console.error("[agency] telnyx conversation lookup failed", error);
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
