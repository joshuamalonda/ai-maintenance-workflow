// Canonical communication-channel + transcript normalisation.
// Shared by the public ingest endpoint and the enrichment job so the
// database always holds one authoritative representation per channel.

export type CommunicationChannel = "phone" | "whatsapp";

type HistoryEntry = {
  role?: string | null;
  message?: string | null;
  text?: string | null;
  content?: string | null;
};

/** True when a value is the raw ElevenLabs conversation-history envelope. */
function parseElevenLabsHistory(value: string): HistoryEntry[] | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed as HistoryEntry[];
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const entries = obj["entries"] ?? obj["transcript"] ?? obj["messages"];
      if (Array.isArray(entries)) return entries as HistoryEntry[];
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Converts any accepted transcript shape into the canonical
 * `"<role>: <text>"` newline-separated form. Only real conversational turns
 * survive: tool_requests, tool_results, system messages and metadata are
 * dropped. Chronological order is preserved as received.
 */
export function normaliseTranscript(value: unknown): string | null {
  if (value == null) return null;

  let entries: HistoryEntry[] | null = null;
  if (typeof value === "string") {
    entries = parseElevenLabsHistory(value);
    if (!entries) return value.slice(0, 100000) || null; // already plain text
  } else if (Array.isArray(value)) {
    entries = value as HistoryEntry[];
  } else if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const nested = obj["entries"] ?? obj["transcript"] ?? obj["messages"];
    entries = Array.isArray(nested) ? (nested as HistoryEntry[]) : null;
  }
  if (!entries) return null;

  const text = entries
    .map((entry) => {
      const rawRole = (entry?.role ?? (entry as Record<string, unknown>)?.["speaker"] ?? "")
        .toString()
        .toLowerCase();
      const role = rawRole === "agent" ? "assistant" : rawRole;
      if (role !== "assistant" && role !== "user") return "";
      const said = (entry?.message ?? entry?.text ?? entry?.content ?? "").toString().trim();
      return said ? `${role}: ${said}` : "";
    })
    .filter(Boolean)
    .join("\n")
    .slice(0, 100000);

  return text || null;
}

/**
 * Determines the authoritative channel from real backend signals, never from
 * transcript wording or the AI's own guess.
 *
 * Priority:
 *  1. An explicit `communication_channel` (or channel-shaped `source_channel`)
 *     supplied by the caller.
 *  2. Structural signals: Telnyx call-control/leg/caller identifiers mean a
 *     phone call; ElevenLabs `conv_...` conversation ids or a raw ElevenLabs
 *     history envelope mean WhatsApp.
 *  3. Default to phone (the long-standing Telnyx path).
 */
export function resolveChannel(input: {
  communication_channel?: string | null;
  source_channel?: string | null;
  call_control_id?: string | null;
  call_leg_id?: string | null;
  call_sid?: string | null;
  caller_number?: string | null;
  conversation_id?: string | null;
  rawTranscript?: unknown;
}): CommunicationChannel {
  const explicit = (input.communication_channel ?? "").trim().toLowerCase();
  if (explicit === "phone" || explicit === "whatsapp") return explicit;

  const declared = (input.source_channel ?? "").trim().toLowerCase();
  if (declared === "whatsapp") return "whatsapp";

  if (input.call_control_id || input.call_leg_id || input.call_sid || input.caller_number) {
    return "phone";
  }
  if ((input.conversation_id ?? "").startsWith("conv_")) return "whatsapp";
  if (
    typeof input.rawTranscript === "string" &&
    input.rawTranscript.includes("x-elevenlabs-history")
  ) {
    return "whatsapp";
  }
  return "phone";
}
