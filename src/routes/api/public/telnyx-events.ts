import { createFileRoute } from "@tanstack/react-router";

type CasePatch = {
  conversation_id?: string;
  transcript?: string;
  call_duration_secs?: number;
  call_recording_url?: string;
};

type CaseRow = {
  id: string;
  conversation_id: string | null;
  transcript: string | null;
  call_duration_secs: number | null;
  call_recording_url: string | null;
};

const ok = (body: unknown = { ok: true }) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

export const Route = createFileRoute("/api/public/telnyx-events")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const publicKey = process.env["TELNYX_PUBLIC_KEY"];
        const apiKey = process.env["TELNYX_API_KEY"];
        if (!publicKey) return new Response("Webhook key not configured", { status: 500 });

        const rawBody = await request.text();
        const { verifyTelnyxSignature, fetchConversationTranscript, mirrorRecording } =
          await import("@/lib/telnyx.server");

        const valid = await verifyTelnyxSignature(
          rawBody,
          request.headers.get("telnyx-signature-ed25519"),
          request.headers.get("telnyx-timestamp"),
          publicKey,
        );
        if (!valid) return new Response("Invalid signature", { status: 401 });

        let event: {
          data?: { event_type?: string; payload?: Record<string, unknown> };
        };
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const eventType = event.data?.event_type;
        const payload = event.data?.payload ?? {};
        const callControlId =
          typeof payload["call_control_id"] === "string" ? payload["call_control_id"] : null;

        // Unknown/unrelated events are acknowledged so Telnyx stops retrying.
        if (!callControlId || !eventType) return ok({ ok: true, ignored: true });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: existing } = await supabaseAdmin
          .from("maintenance_cases")
          .select("id, conversation_id, transcript, call_duration_secs, call_recording_url")
          .eq("call_control_id", callControlId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle<CaseRow>();

        if (!existing) return ok({ ok: true, matched: false });

        const patch: CasePatch = {};

        if (eventType === "call.conversation.ended") {
          const conversationId =
            typeof payload["conversation_id"] === "string" ? payload["conversation_id"] : null;
          if (conversationId) {
            if (!existing.conversation_id) patch.conversation_id = conversationId;
            if (!existing.transcript && apiKey) {
              const transcript = await fetchConversationTranscript(conversationId, apiKey);
              if (transcript) patch.transcript = transcript;
            }
          }
        }

        if (eventType === "call.hangup" && existing.call_duration_secs == null) {
          const start = payload["start_time"];
          const end = payload["end_time"];
          if (typeof start === "string" && typeof end === "string") {
            const seconds = Math.round(
              (new Date(end).getTime() - new Date(start).getTime()) / 1000,
            );
            if (Number.isFinite(seconds) && seconds >= 0) patch.call_duration_secs = seconds;
          }
        }

        if (eventType === "call.recording.saved" && !existing.call_recording_url) {
          const urls = payload["recording_urls"] as Record<string, string> | undefined;
          const publicUrls = payload["public_recording_urls"] as
            | Record<string, string>
            | undefined;
          const source =
            urls?.["mp3"] ?? urls?.["wav"] ?? publicUrls?.["mp3"] ?? publicUrls?.["wav"] ?? null;
          if (source) patch.call_recording_url = await mirrorRecording(source, callControlId);
        }

        if (Object.keys(patch).length === 0) return ok({ ok: true, unchanged: true });

        const { error } = await supabaseAdmin
          .from("maintenance_cases")
          .update(patch)
          .eq("id", existing.id);
        if (error) {
          console.error("[telnyx] case update failed", error);
          return ok({ ok: false, error: error.message });
        }

        return ok({ ok: true, updated: Object.keys(patch) });
      },
    },
  },
});