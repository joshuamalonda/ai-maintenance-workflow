import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { Database } from "@/integrations/supabase/types";

export type MaintenanceCase = Database["public"]["Tables"]["maintenance_cases"]["Row"];

const CASE_COLUMNS =
  "id, reference_code, tenant_name, property_address, issue_category, issue_description, urgency, status, ai_summary, ai_confidence, last_ai_action, source_channel, reported_at, created_at, updated_at, preferred_language, priority, contractor_required, recommended_action, troubleshooting, missing_information, transcript, conversation_id, call_sid, call_duration_secs";

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
