import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { Database } from "@/integrations/supabase/types";

export type MaintenanceCase = Database["public"]["Tables"]["maintenance_cases"]["Row"];

const CASE_COLUMNS =
  "id, reference_code, tenant_name, property_address, issue_category, issue_description, urgency, status, ai_summary, ai_confidence, last_ai_action, source_channel, reported_at, created_at, updated_at, preferred_language, priority, contractor_required, recommended_action, troubleshooting, missing_information, transcript, conversation_id, call_sid, call_control_id, call_duration_secs, call_recording_url";

export const listCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("maintenance_cases")
      .select(CASE_COLUMNS)
      .order("reported_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as MaintenanceCase[];
  });

export const getCase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("maintenance_cases")
      .select(CASE_COLUMNS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row ?? null) as MaintenanceCase | null;
  });

export const deleteCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("maintenance_cases")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

/**
 * Resolves a playable URL for a case recording. Recordings mirrored into
 * durable storage are referenced as `storage:<bucket>/<path>` and need a
 * short-lived signed URL.
 */
export const getRecordingUrl = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("maintenance_cases")
      .select("call_recording_url")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const value = row?.call_recording_url ?? null;
    if (!value) return null;
    if (!value.startsWith("storage:")) return value;

    const [bucket, ...rest] = value.slice("storage:".length).split("/");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(rest.join("/"), 60 * 60);
    if (signError) throw new Error(signError.message);
    return signed?.signedUrl ?? null;
  });
