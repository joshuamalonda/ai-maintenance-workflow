import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

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

const transcriptTurn = z.object({
  role: z.string().max(50).optional(),
  speaker: z.string().max(50).optional(),
  message: z.string().optional(),
  text: z.string().optional(),
  content: z.string().optional(),
});

// Accepts either a plain transcript string or a structured turn array
// (ElevenLabs / Telnyx conversation format) which is flattened to text.
const transcriptField = z
  .union([z.string().max(100000), z.array(transcriptTurn).max(2000)])
  .nullish()
  .transform((value) => {
    if (value == null) return value;
    if (typeof value === "string") return value;
    return value
      .map((turn) => {
        const who = turn.role ?? turn.speaker ?? "unknown";
        const said = turn.message ?? turn.text ?? turn.content ?? "";
        return `${who}: ${said}`.trim();
      })
      .filter((line) => line.length > 0)
      .join("\n")
      .slice(0, 100000);
  });

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
  source_channel: z.string().max(50).default("email"),
  reported_at: z.string().datetime().optional(),
  preferred_language: z.string().max(100).nullish(),
  priority: z.string().max(50).nullish(),
  contractor_required: z.boolean().nullish(),
  recommended_action: z.string().max(5000).nullish(),
  troubleshooting: z.string().max(5000).nullish(),
  missing_information: z.string().max(5000).nullish(),
  transcript: transcriptField,
  conversation_id: z.string().max(200).nullish(),
  call_sid: z.string().max(200).nullish(),
  call_duration_secs: z.number().int().min(0).max(86400).nullish(),
  call_recording_url: z.string().url().max(2000).nullish(),
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

        const { reference_code, ...rest } = parsed.data;
        const insertPayload = reference_code ? { ...rest, reference_code } : rest;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from("maintenance_cases")
          .insert(insertPayload as never)
          .select("id, reference_code")
          .single();

        if (error) return json({ error: error.message }, 400);
        return json({ ok: true, case: data }, 201);
      },
    },
  },
});