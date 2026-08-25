import { createFileRoute } from "@tanstack/react-router";

// Telnyx Messaging API v2 webhook receiver.
//
// Scope: verification + idempotent recording ONLY. This endpoint deliberately
// performs no messaging, no case mutation, and no tenant/landlord/contractor
// notification. It exists so the Messaging Profile can be pointed at a real,
// verified production URL ahead of the SMS workflow.

const ACCEPTED_EVENT_TYPES = new Set([
  "message.received",
  "message.sent",
  "message.finalized",
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

type TelnyxMessagingPayload = {
  id?: string;
  direction?: string;
  from?: { phone_number?: string } | string;
  to?: Array<{ phone_number?: string }> | string;
  received_at?: string;
  sent_at?: string;
  completed_at?: string;
};

function phone(value: TelnyxMessagingPayload["from"]): string | null {
  if (typeof value === "string") return value;
  return value?.phone_number ?? null;
}

function firstTo(value: TelnyxMessagingPayload["to"]): string | null {
  if (typeof value === "string") return value;
  return value?.[0]?.phone_number ?? null;
}

export const Route = createFileRoute("/api/public/telnyx/messaging")({
  server: {
    handlers: {
      // Telnyx probes some endpoints with GET; answer cheaply without leaking anything.
      GET: async () => json({ ok: true, endpoint: "telnyx-messaging-webhook" }),

      POST: async ({ request }) => {
        const publicKey = process.env["TELNYX_PUBLIC_KEY"];
        if (!publicKey) {
          console.error("[telnyx-sms] TELNYX_PUBLIC_KEY not configured");
          return new Response("Webhook key not configured", { status: 500 });
        }

        const rawBody = await request.text();

        // Same Ed25519 scheme Telnyx uses for Voice webhooks:
        // verify(signature, `${timestamp}|${rawBody}`) with 5-minute replay window.
        const { verifyTelnyxSignature } = await import("@/lib/telnyx.server");
        const valid = await verifyTelnyxSignature(
          rawBody,
          request.headers.get("telnyx-signature-ed25519"),
          request.headers.get("telnyx-timestamp"),
          publicKey,
        );
        if (!valid) return new Response("Invalid signature", { status: 401 });

        let event: {
          data?: {
            id?: string;
            event_type?: string;
            occurred_at?: string;
            payload?: TelnyxMessagingPayload;
          };
        };
        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const eventId = event.data?.id;
        const eventType = event.data?.event_type;
        if (!eventId || !eventType) return json({ ok: true, ignored: "malformed" });
        if (!ACCEPTED_EVENT_TYPES.has(eventType)) {
          return json({ ok: true, ignored: eventType });
        }

        const payload = event.data?.payload ?? {};

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // Idempotency: event_id is the primary key, so a redelivered event is a
          // no-op insert rather than a duplicate side effect.
          const { error } = await supabaseAdmin
            .from("telnyx_messaging_events")
            .upsert(
              {
                event_id: eventId,
                event_type: eventType,
                message_id: payload.id ?? null,
                direction: payload.direction ?? null,
                from_number: phone(payload.from),
                to_number: firstTo(payload.to),
                occurred_at:
                  event.data?.occurred_at ??
                  payload.completed_at ??
                  payload.sent_at ??
                  payload.received_at ??
                  null,
                payload: event as unknown as Record<string, unknown>,
              },
              { onConflict: "event_id", ignoreDuplicates: true },
            );
          if (error) console.error("[telnyx-sms] event record failed", error);
        } catch (error) {
          // Never fail the delivery on a logging problem — Telnyx would retry forever.
          console.error("[telnyx-sms] event record error", error);
        }

        return json({ ok: true, event_type: eventType });
      },
    },
  },
});
