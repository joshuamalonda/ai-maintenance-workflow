// Server-only: scheduled pull-based enrichment of maintenance cases with
// Telnyx AI conversation transcripts, call duration and call recordings.
//
// This runs on a schedule (pg_cron -> /api/public/enrich-calls) instead of
// relying on Call Control webhooks, because the assistant's phone number is
// bound to a TeXML application that cannot deliver call.* events.

import { mirrorRecording } from "@/lib/telnyx.server";

const TELNYX_API = "https://api.telnyx.com/v2";

/** How far back we look for cases/conversations/recordings to reconcile. */
const LOOKBACK_HOURS = 48;
/** Give up on a case after this many enrichment passes. */
const MAX_ATTEMPTS = 12;
/** Widest allowed gap between the case being reported and the call. */
const TIME_WINDOW_MS = 30 * 60 * 1000;

type CaseRow = {
  id: string;

  created_at: string;
  caller_number: string | null;
  call_control_id: string | null;
  call_leg_id: string | null;
  conversation_id: string | null;
  transcript: string | null;
  call_duration_secs: number | null;
  call_recording_url: string | null;
  recording_storage_path: string | null;
  enrichment_attempts: number;
};

type Conversation = {
  id: string;
  created_at?: string | null;
  last_message_at?: string | null;
  metadata?: Record<string, unknown> | null;
};

type Recording = {
  id: string;
  call_control_id?: string | null;
  call_leg_id?: string | null;
  call_session_id?: string | null;
  created_at?: string | null;
  recording_started_at?: string | null;
  duration_millis?: number | null;
  download_urls?: { mp3?: string | null; wav?: string | null } | null;
};

function normaliseNumber(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/[^0-9]/g, "");
  return digits.length >= 7 ? digits.slice(-10) : null;
}

function metaString(meta: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!meta) return null;
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

async function telnyxGet<T>(path: string, apiKey: string): Promise<T[]> {
  try {
    const response = await fetch(`${TELNYX_API}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      console.error("[enrich] telnyx GET failed", path, response.status);
      return [];
    }
    const payload = (await response.json()) as { data?: T[] };
    return payload.data ?? [];
  } catch (error) {
    console.error("[enrich] telnyx GET error", path, error);
    return [];
  }
}

type TelnyxMessage = { role?: string | null; content?: string | null; text?: string | null };

async function fetchTranscript(conversationId: string, apiKey: string): Promise<string | null> {
  const messages = await telnyxGet<TelnyxMessage>(
    `/ai/conversations/${encodeURIComponent(conversationId)}/messages`,
    apiKey,
  );
  const text = messages
    .map((m) => {
      const who = m.role ?? "unknown";
      const said = (m.content ?? m.text ?? "").trim();
      return said ? `${who}: ${said}` : "";
    })
    .filter(Boolean)
    .join("\n")
    .slice(0, 100000);
  return text || null;
}

function scoreConversation(row: CaseRow, conversation: Conversation): number | null {
  const meta = conversation.metadata ?? null;

  // Strongest signal: the call control id captured at tool-call time.
  const convControlId = metaString(meta, [
    "telnyx_call_control_id",
    "call_control_id",
    "telnyx_call_id",
  ]);
  if (row.call_control_id && convControlId && row.call_control_id === convControlId) return 1000;

  const started = conversation.created_at ?? conversation.last_message_at;
  if (!started) return null;
  const delta = Math.abs(
    new Date(row.created_at).getTime() - new Date(started).getTime(),
  );
  if (delta > TIME_WINDOW_MS) return null;

  // Fallback: caller number + closeness in time.
  const caller = normaliseNumber(row.caller_number);
  const convCaller = normaliseNumber(
    metaString(meta, ["telnyx_end_user_target", "from", "caller_number", "end_user_target"]),
  );
  const proximity = 1 - delta / TIME_WINDOW_MS; // 0..1
  if (caller && convCaller) {
    if (caller !== convCaller) return null;
    return 500 + proximity * 100;
  }

  // Weakest signal: time proximity only, and only when very close.
  if (delta <= 5 * 60 * 1000) return 100 + proximity * 100;
  return null;
}

function pickRecording(row: CaseRow, recordings: Recording[]): Recording | null {
  const byId = recordings.find(
    (r) =>
      (row.call_control_id && r.call_control_id === row.call_control_id) ||
      (row.call_leg_id && r.call_leg_id === row.call_leg_id),
  );
  if (byId) return byId;

  const target = new Date(row.created_at).getTime();
  let best: { rec: Recording; delta: number } | null = null;
  for (const rec of recordings) {
    const started = rec.recording_started_at ?? rec.created_at;
    if (!started) continue;
    const delta = Math.abs(target - new Date(started).getTime());
    if (delta > TIME_WINDOW_MS) continue;
    if (!best || delta < best.delta) best = { rec, delta };
  }
  return best?.rec ?? null;
}

export type EnrichmentSummary = {
  scanned: number;
  updated: number;
  completed: number;
  details: Array<{ case_id: string; fields: string[] }>;
};

/**
 * Reconciles recent maintenance cases against Telnyx conversations and
 * recordings. Idempotent: fields that are already populated are never
 * rewritten, and cases are only ever updated (never inserted).
 */
export async function runEnrichment(apiKey: string): Promise<EnrichmentSummary> {
  const since = new Date(Date.now() - LOOKBACK_HOURS * 3600 * 1000).toISOString();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: cases, error } = await supabaseAdmin
    .from("maintenance_cases")
    .select(
      "id, created_at, caller_number, call_control_id, call_leg_id, conversation_id, transcript, call_duration_secs, call_recording_url, recording_storage_path, enrichment_attempts",
    )
    .eq("enrichment_status", "pending")
    .lt("enrichment_attempts", MAX_ATTEMPTS)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(50)
    .returns<CaseRow[]>();

  if (error) throw new Error(error.message);
  const rows = cases ?? [];
  const summary: EnrichmentSummary = { scanned: rows.length, updated: 0, completed: 0, details: [] };
  if (rows.length === 0) return summary;

  const [conversations, recordings] = await Promise.all([
    telnyxGet<Conversation>(`/ai/conversations?page[size]=100`, apiKey),
    telnyxGet<Recording>(`/recordings?page[size]=100&filter[created_at][gte]=${since}`, apiKey),
  ]);

  const claimedConversations = new Set(
    rows.map((r) => r.conversation_id).filter((v): v is string => Boolean(v)),
  );

  for (const row of rows) {
    const patch: Record<string, unknown> = {};

    // 1. Resolve the conversation (strongest match wins, one case per conversation).
    let conversationId = row.conversation_id;
    if (!conversationId) {
      let best: { id: string; score: number } | null = null;
      for (const conversation of conversations) {
        if (claimedConversations.has(conversation.id)) continue;
        const score = scoreConversation(row, conversation);
        if (score == null) continue;
        if (!best || score > best.score) best = { id: conversation.id, score };
      }
      if (best) {
        conversationId = best.id;
        claimedConversations.add(best.id);
        patch["conversation_id"] = best.id;
      }
    }

    // 2. Transcript (only when we don't already have one).
    if (conversationId && !row.transcript) {
      const transcript = await fetchTranscript(conversationId, apiKey);
      if (transcript) patch["transcript"] = transcript;
    }

    // 3. Recording + duration.
    if (!row.call_recording_url || row.call_duration_secs == null) {
      const recording = pickRecording(row, recordings);
      if (recording) {
        if (!row.call_leg_id && recording.call_leg_id) patch["call_leg_id"] = recording.call_leg_id;
        if (row.call_duration_secs == null && typeof recording.duration_millis === "number") {
          patch["call_duration_secs"] = Math.round(recording.duration_millis / 1000);
        }
        if (!row.call_recording_url) {
          const source = recording.download_urls?.mp3 ?? recording.download_urls?.wav ?? null;
          if (source) {
            const stored = await mirrorRecording(
              source,
              row.call_control_id ?? recording.id ?? row.id,
            );
            patch["call_recording_url"] = stored;
            if (stored.startsWith("storage:")) {
              patch["recording_storage_path"] = stored.slice("storage:".length);
            }
          }
        }
      }
    }

    const hasTranscript = Boolean(row.transcript ?? patch["transcript"]);
    const hasRecording = Boolean(row.call_recording_url ?? patch["call_recording_url"]);
    const attempts = row.enrichment_attempts + 1;

    patch["enrichment_attempts"] = attempts;
    patch["enrichment_last_checked_at"] = new Date().toISOString();
    if ((hasTranscript && hasRecording) || attempts >= MAX_ATTEMPTS) {
      patch["enrichment_status"] = hasTranscript || hasRecording ? "complete" : "exhausted";
      summary.completed += 1;
    }

    const { error: updateError } = await supabaseAdmin
      .from("maintenance_cases")
      .update(patch as never)
      .eq("id", row.id);

    if (updateError) {
      console.error("[enrich] update failed", row.id, updateError.message);
      continue;
    }

    const fields = Object.keys(patch).filter(
      (key) => !key.startsWith("enrichment_"),
    );
    if (fields.length > 0) {
      summary.updated += 1;
      summary.details.push({ case_id: row.id, fields });
    }
  }

  return summary;
}