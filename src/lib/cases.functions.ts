import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { Database } from "@/integrations/supabase/types";

export type MaintenanceCase = Database["public"]["Tables"]["maintenance_cases"]["Row"];

const CASE_COLUMNS =
  "id, reference_code, tenant_name, property_address, issue_category, issue_description, urgency, status, ai_summary, ai_confidence, last_ai_action, source_channel, communication_channel, created_at, updated_at, preferred_language, priority, contractor_required, recommended_action, troubleshooting, missing_information, transcript, conversation_id, call_sid, call_control_id, call_duration_secs, call_recording_url, contractor_response_status, contractor_responded_at";

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

/**
 * Contractors currently assigned to a property, for manual case assignment.
 * RLS scopes both the property and the contractors to the caller's agency.
 */
export const listPropertyContractorsForCase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ propertyId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: links, error } = await context.supabase
      .from("contractor_properties")
      .select("contractor:contractors(id, name, company, trade, phone, email, active)")
      .eq("property_id", data.propertyId);
    if (error) throw new Error(error.message);
    return (links ?? [])
      .map((l) => (l as unknown as { contractor: LinkedContact & { company: string | null; trade: string | null; active: boolean } }).contractor)
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));
  });

/**
 * Assigns (or clears) the contractor on a case. Both rows are verified through
 * the caller's RLS-scoped client, and the contractor must already be linked to
 * the case's property.
 */
export const assignCaseContractor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ caseId: z.string().uuid(), contractorId: z.string().uuid().nullable() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("maintenance_cases")
      .select("id, agency_id, property_id")
      .eq("id", data.caseId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Case not found");

    let contractorId: string | null = null;
    let assignedAt: string | null = null;

    if (data.contractorId) {
      if (!row.property_id) throw new Error("Link a property before assigning a contractor");
      const { data: link, error: linkError } = await context.supabase
        .from("contractor_properties")
        .select("contractor_id")
        .eq("property_id", row.property_id)
        .eq("contractor_id", data.contractorId)
        .maybeSingle();
      if (linkError) throw new Error(linkError.message);
      if (!link) throw new Error("That contractor isn't assigned to this property");
      contractorId = data.contractorId;
      assignedAt = new Date().toISOString();
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin
      .from("maintenance_cases")
      .update({
        contractor_id: contractorId,
        assigned_at: assignedAt,
        // Assigning starts a fresh response cycle; clearing resets it entirely.
        contractor_response_status: contractorId ? "pending" : null,
        contractor_responded_at: null,
      })
      .eq("id", row.id)
      .eq("agency_id", row.agency_id);
    if (updateError) throw new Error(updateError.message);

    return { caseId: row.id, contractorId, assignedAt };
  });

/**
 * Records the assigned contractor's accept/decline response on a case.
 * Ownership is checked through the caller's RLS-scoped client and the update
 * only applies when the case still has a contractor assigned. Assignment
 * fields are deliberately left untouched.
 */
export const setContractorResponse = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        caseId: z.string().uuid(),
        response: z.enum(["accepted", "declined"]),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("maintenance_cases")
      .select("id, agency_id, contractor_id")
      .eq("id", data.caseId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Case not found");
    if (!row.contractor_id) throw new Error("No contractor is assigned to this case");

    const respondedAt = new Date().toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin
      .from("maintenance_cases")
      .update({
        contractor_response_status: data.response,
        contractor_responded_at: respondedAt,
      })
      .eq("id", row.id)
      .eq("agency_id", row.agency_id)
      .eq("contractor_id", row.contractor_id);
    if (updateError) throw new Error(updateError.message);

    return { caseId: row.id, response: data.response, respondedAt };
  });
