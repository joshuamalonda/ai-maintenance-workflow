// Server-only helpers for the Telnyx post-call enrichment flow.

const TELNYX_API = "https://api.telnyx.com/v2";
const RECORDINGS_BUCKET = "call-recordings";

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Verifies a Telnyx Ed25519 webhook signature over `timestamp|payload`. */
export async function verifyTelnyxSignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null,
  publicKeyBase64: string,
): Promise<boolean> {
  if (!signature || !timestamp) return false;

  // Reject deliveries older than 5 minutes (replay protection).
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      base64ToBytes(publicKeyBase64),
      { name: "Ed25519" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      { name: "Ed25519" },
      key,
      base64ToBytes(signature),
      new TextEncoder().encode(`${timestamp}|${rawBody}`),
    );
  } catch (error) {
    console.error("[telnyx] signature verification failed", error);
    return false;
  }
}

type TelnyxMessage = {
  role?: string | null;
  sender?: string | null;
  content?: string | null;
  text?: string | null;
  created_at?: string | null;
  sent_at?: string | null;
  timestamp?: string | null;
  tool_calls?: unknown;
  tool_call_id?: string | null;
};

function flattenMessages(messages: TelnyxMessage[]): string {
  return messages
    .filter((m) => {
      const role = (m.role ?? m.sender ?? "").toLowerCase();
      if (role !== "user" && role !== "assistant") return false;
      if (m.tool_call_id) return false;
      if (Array.isArray(m.tool_calls) && m.tool_calls.length > 0) return false;
      return Boolean((m.content ?? m.text ?? "").trim());
    })
    .map((m, index) => ({ m, index }))
    .sort((a, b) => {
      const ta = Date.parse(a.m.created_at ?? a.m.sent_at ?? a.m.timestamp ?? "");
      const tb = Date.parse(b.m.created_at ?? b.m.sent_at ?? b.m.timestamp ?? "");
      if (Number.isFinite(ta) && Number.isFinite(tb) && ta !== tb) return ta - tb;
      return a.index - b.index;
    })
    .map((entry) => entry.m)
    .map((m) => {
      const who = (m.role ?? m.sender ?? "unknown").toLowerCase();
      const said = (m.content ?? m.text ?? "").trim();
      return said ? `${who}: ${said}` : "";
    })
    .filter(Boolean)
    .join("\n")
    .slice(0, 100000);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Fetches the finished conversation transcript, retrying with exponential
 * backoff because Telnyx finalises messages slightly after the call ends.
 */
export async function fetchConversationTranscript(
  conversationId: string,
  apiKey: string,
  attempts = 4,
): Promise<string | null> {
  let delay = 1000;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) {
      await sleep(delay);
      delay *= 2;
    }
    try {
      const { fetchAllConversationMessages } = await import("@/lib/telnyx-enrich.server");
      const messages = (await fetchAllConversationMessages(
        conversationId,
        apiKey,
      )) as TelnyxMessage[];
      const transcript = flattenMessages(messages);
      if (transcript) return transcript;
    } catch (error) {
      console.error("[telnyx] transcript fetch error", error);
    }
  }
  return null;
}

/**
 * Copies a (short-lived) Telnyx recording into durable storage and returns a
 * `storage:` reference. Falls back to the original URL if mirroring fails.
 */
export async function mirrorRecording(
  sourceUrl: string,
  callControlId: string,
): Promise<string> {
  try {
    const response = await fetch(sourceUrl);
    if (!response.ok) return sourceUrl;
    const bytes = new Uint8Array(await response.arrayBuffer());
    const extension = sourceUrl.includes(".wav") ? "wav" : "mp3";
    const path = `${callControlId.replace(/[^a-zA-Z0-9_-]/g, "")}.${extension}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from(RECORDINGS_BUCKET)
      .upload(path, bytes, {
        contentType: extension === "wav" ? "audio/wav" : "audio/mpeg",
        upsert: true,
      });
    if (error) {
      console.error("[telnyx] recording mirror failed", error);
      return sourceUrl;
    }
    return `storage:${RECORDINGS_BUCKET}/${path}`;
  } catch (error) {
    console.error("[telnyx] recording mirror error", error);
    return sourceUrl;
  }
}

export { RECORDINGS_BUCKET };