import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { normaliseTranscript, resolveChannel } from "@/lib/channel";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

// Accepts a plain transcript string, a structured turn array, or the raw
// ElevenLabs conversation-history envelope. Normalisation to the canonical
// "role: text" form happens in normaliseTranscript().
const transcriptField = z.unknown().nullish();

const caseSchema = z.object({
  reference_code: z.string().min(1).max(64).optional(),
  tenant_name: z.string().min(1).max(200),
  property_address: z.string().min(1).max(500),
  issue_category: z.string().min(1).max(100),
  issue_description: z.string().min(1).max(5000),
  urgency: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z.enum(["needs_attention", "in_progress", "completed"]).default("needs_attention"),
  ai_summary: z.string().max(5000).nullish(),
  ai_confidence: z.number().min(0).max(1).nullish(),
  last_ai_action: z.string().max(2000).nullish(),
  // Accepted for backwards compatibility with older tool payloads, but
  // ignored: the backend alone resolves the channel from real signals.
  source_channel: z.string().max(50).nullish(),
  // Authoritative channel hint. Case-insensitive ("Phone" -> "phone").
  communication_channel: z
    .preprocess(
      (value) => (typeof value === "string" ? value.trim().toLowerCase() : value),
      z.enum(["phone", "whatsapp"]).nullish(),
    )
    .nullish(),
  // reported_at intentionally not accepted: the database created_at timestamp
  // is the source of truth for when a case was reported.
  preferred_language: z.string().max(100).nullish(),
  priority: z.string().max(50).nullish(),
  contractor_required: z.boolean().nullish(),
  recommended_action: z.string().max(5000).nullish(),
  troubleshooting: z.string().max(5000).nullish(),
  missing_information: z.string().max(5000).nullish(),
  transcript: transcriptField,
  conversation_id: z.string().max(200).nullish(),
  call_sid: z.string().max(200).nullish(),
  call_control_id: z.string().max(200).nullish(),
  call_leg_id: z.string().max(200).nullish(),
  caller_number: z.string().max(50).nullish(),
  call_duration_secs: z.number().int().min(0).max(86400).nullish(),
  call_recording_url: z.string().url().max(2000).nullish(),
  // Destination endpoint the tenant reached (Ovelo's number / WhatsApp
  // sender), used to resolve the owning agency. Never the tenant's number.
  destination_number: z.string().max(50).nullish(),
  telnyx_agent_target: z.string().max(50).nullish(),
  whatsapp_business_number: z.string().max(50).nullish(),
  to: z.string().max(50).nullish(),
});

export const Route = createFileRoute("/api/public/cases")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: corsHeaders }),
      POST: async ({ request }) => {
        const expected = process.env["CASE_INGEST_KEY"];
        if (!expected) return json({ error: "Ingest key not configured" }, 500);

        const auth = request.headers.get("authorization") ?? "";
        const provided = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (provided.length !== expected.length || provided !== expected) {
          return json({ error: "Unauthorized" }, 401);
        }

        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json({ error: "Invalid JSON body" }, 400);
        }

        const parsed = caseSchema.safeParse(body);
        if (!parsed.success) {
          return json({ error: "Validation failed", issues: parsed.error.issues }, 400);
        }

        const {
          reference_code,
          source_channel: _ignoredSourceChannel,
          destination_number,
          telnyx_agent_target,
          whatsapp_business_number,
          to,
          ...rest
        } = parsed.data;

        // ---- Agency resolution (strict: no default tenant) ----------------
        const { fetchTelnyxCallContext, resolveEndpointAgency } = await import(
          "@/lib/agency.server"
        );

        // Prefer the server-verified Telnyx destination over anything in the
        // payload; fall back to explicitly supplied destination fields.
        let destination: string | null = null;
        let resolvedCallControlId: string | null = rest.call_control_id ?? null;
        const telnyxKey = process.env["TELNYX_API_KEY"];
        if (telnyxKey && (rest.call_control_id || rest.conversation_id)) {
          const context = await fetchTelnyxCallContext(
            {
              callControlId: rest.call_control_id ?? null,
              conversationId: rest.conversation_id ?? null,
            },
            telnyxKey,
          );
          if (context) {
            destination = context.agentTarget;
            resolvedCallControlId = resolvedCallControlId ?? context.callControlId;
          }
        }
        destination =
          destination ??
          telnyx_agent_target ??
          destination_number ??
          whatsapp_business_number ??
          to ??
          null;

        if (!destination) {
          return json(
            {
              error:
                "Missing destination endpoint. Send the Ovelo number/WhatsApp sender the tenant contacted (destination_number).",
            },
            422,
          );
        }

        const endpoint = await resolveEndpointAgency(destination);
        if (!endpoint) {
          return json(
            { error: "Unknown communication endpoint", destination },
            422,
          );
        }

        // Channel is decided from real backend signals, never from the AI's
        // own source_channel guess or from transcript wording.
        // The registered endpoint is the strongest signal of all.
        const communication_channel = endpoint.channel ?? resolveChannel({
          communication_channel: rest.communication_channel ?? null,
          call_control_id: rest.call_control_id ?? null,
          call_leg_id: rest.call_leg_id ?? null,
          call_sid: rest.call_sid ?? null,
          caller_number: rest.caller_number ?? null,
          conversation_id: rest.conversation_id ?? null,
          rawTranscript: rest.transcript,
        });

        const transcript = normaliseTranscript(rest.transcript);

        const channelFields =
          communication_channel === "whatsapp"
            ? {
                // Phone-only fields are never fabricated for WhatsApp.
                call_duration_secs: null,
                call_recording_url: null,
                call_control_id: null,
                call_leg_id: null,
                call_sid: null,
                caller_number: null,
                enrichment_status: "not_applicable",
              }
            : {};

        const insertPayload = {
          ...rest,
          transcript,
          communication_channel,
          source_channel: communication_channel,
          agency_id: endpoint.agencyId,
          ...(communication_channel === "phone" && resolvedCallControlId
            ? { call_control_id: resolvedCallControlId }
            : {}),
          ...channelFields,
          ...(reference_code ? { reference_code } : {}),
        };

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("maintenance_cases")
          .insert(insertPayload as never)
          .select("id, reference_code")
          .single();

        if (error) return json({ error: error.message }, 400);

        // Post-insert, best-effort directory matching. Never affects the
        // intake result: failures leave property_id/tenant_id null.
        try {
          const { matchCaseToProperty } = await import("@/lib/matching.server");
          const match = await matchCaseToProperty({
            caseId: (data as { id: string }).id,
            agencyId: endpoint.agencyId,
            propertyAddress: rest.property_address,
          });

          // Confirmation SMS only when the case is linked to a real property,
          // which is the only source of verified tenant/landlord numbers.
          if (match.matched) {
            const { notifyCaseCreated } = await import("@/lib/case-notifications.server");
            await notifyCaseCreated({
              agencyId: endpoint.agencyId,
              propertyId: match.propertyId,
              referenceCode: (data as { reference_code: string }).reference_code,
              propertyAddress: rest.property_address,
            });
          }
        } catch {
          /* matching is advisory only */
        }


        return json({ ok: true, case: data }, 201);
      },
    },
  },
});