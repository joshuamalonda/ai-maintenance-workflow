import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { Database } from "@/integrations/supabase/types";

export type MaintenanceCase = Database["public"]["Tables"]["maintenance_cases"]["Row"];

const CASE_COLUMNS =
  "id, reference_code, tenant_name, property_address, issue_category, issue_description, urgency, status, ai_summary, ai_confidence, last_ai_action, source_channel, communication_channel, created_at, updated_at, preferred_language, priority, contractor_required, recommended_action, troubleshooting, missing_information, transcript, conversation_id, call_sid, call_control_id, call_duration_secs, call_recording_url";

export const listCases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("maintenance_cases")
      .select(CASE_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as MaintenanceCase[];
  });

const DETAIL_COLUMNS = `${CASE_COLUMNS}, agency_id, property_id, tenant_id, contractor_id, assigned_at, property:properties(id, address, postcode, landlord:landlords(id, name, phone, email), tenant:tenants(id, name, phone, email)), linked_tenant:tenants(id, name, phone, email), contractor:contractors(id, name, company, trade, phone, email)`;

export type LinkedContact = { id: string; name: string; phone: string | null; email: string | null };

export type CaseDetail = MaintenanceCase & {
  property:
    | {
        id: string;
        address: string;
        postcode: string | null;
        landlord: LinkedContact | null;
        tenant: LinkedContact | null;
      }
    | null;
  linked_tenant: LinkedContact | null;
  contractor:
    | (LinkedContact & { company: string | null; trade: string | null })
    | null;
};

export const getCase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("maintenance_cases")
      .select(DETAIL_COLUMNS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row ?? null) as unknown as CaseDetail | null;
  });

/**
 * Manually links a case to a property in the same agency. Ownership of both
 * rows is verified through the caller's RLS-scoped client before the
 * privileged update runs, so cross-agency linking is impossible.
 */
export const linkCaseToProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ caseId: z.string().uuid(), propertyId: z.string().uuid().nullable() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("maintenance_cases")
      .select("id, agency_id")
      .eq("id", data.caseId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Case not found");

    let propertyId: string | null = null;
    let tenantId: string | null = null;

    if (data.propertyId) {
      const { data: property, error: propError } = await context.supabase
        .from("properties")
        .select("id, agency_id, tenant_id")
        .eq("id", data.propertyId)
        .maybeSingle();
      if (propError) throw new Error(propError.message);
      if (!property || property.agency_id !== row.agency_id) {
        throw new Error("Property not found for this agency");
      }
      propertyId = property.id;
      tenantId = property.tenant_id ?? null;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin
      .from("maintenance_cases")
      .update({ property_id: propertyId, tenant_id: tenantId })
      .eq("id", row.id)
      .eq("agency_id", row.agency_id);
    if (updateError) throw new Error(updateError.message);

    return { caseId: row.id, propertyId, tenantId };
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
