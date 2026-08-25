import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Property = Database["public"]["Tables"]["properties"]["Row"];
export type Landlord = Database["public"]["Tables"]["landlords"]["Row"];
export type Tenant = Database["public"]["Tables"]["tenants"]["Row"];
export type Contractor = Database["public"]["Tables"]["contractors"]["Row"];

type Client = SupabaseClient<Database>;

async function currentAgencyId(supabase: Client): Promise<string> {
  const { data, error } = await supabase
    .from("agency_members")
    .select("agency_id")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Your account is not linked to an agency yet.");
  return data.agency_id;
}

const contactSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  phone: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
});

const nullify = (v?: string | null) => {
  const t = (v ?? "").trim();
  return t.length ? t : null;
};

/* ---------------------------------- read --------------------------------- */

export type PropertyListItem = Property & {
  landlord: Pick<Landlord, "id" | "name"> | null;
  tenant: Pick<Tenant, "id" | "name"> | null;
};

export const listProperties = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("properties")
      .select(
        "id, agency_id, address, postcode, landlord_id, tenant_id, created_at, updated_at, landlord:landlords(id, name), tenant:tenants(id, name)",
      )
      .order("address", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as PropertyListItem[];
  });

export const getProperty = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Client;

    const { data: property, error } = await supabase
      .from("properties")
      .select(
        "id, agency_id, address, postcode, landlord_id, tenant_id, created_at, updated_at, landlord:landlords(id, name, phone, email), tenant:tenants(id, name, phone, email)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!property) return null;

    const { data: links, error: linkError } = await supabase
      .from("contractor_properties")
      .select("id, contractor:contractors(id, name, company, trade, phone, email, active)")
      .eq("property_id", data.id);
    if (linkError) throw new Error(linkError.message);

    // Maintenance cases stay untouched by this step; they are matched by the
    // address text captured at intake time.
    const address = (property as unknown as Property).address;
    const { data: cases, error: caseError } = await supabase
      .from("maintenance_cases")
      .select(
        "id, reference_code, tenant_name, property_address, issue_category, urgency, status, created_at",
      )
      .ilike("property_address", `%${address}%`)
      .order("created_at", { ascending: false });
    if (caseError) throw new Error(caseError.message);

    return {
      property: property as unknown as Property & {
        landlord: Landlord | null;
        tenant: Tenant | null;
      },
      contractors: (links ?? []).map((l) => ({
        linkId: (l as { id: string }).id,
        contractor: (l as unknown as { contractor: Contractor }).contractor,
      })),
      cases: (cases ?? []) as Array<{
        id: string;
        reference_code: string;
        tenant_name: string;
        property_address: string;
        issue_category: string;
        urgency: string;
        status: string;
        created_at: string;
      }>,
    };
  });

export const listLandlords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("landlords")
      .select("id, agency_id, name, phone, email, created_at, updated_at")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Landlord[];
  });

export const listTenants = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("tenants")
      .select("id, agency_id, name, phone, email, created_at, updated_at")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Tenant[];
  });

export const listContractors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contractors")
      .select("id, agency_id, name, company, trade, phone, whatsapp, email, active, created_at, updated_at")
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Contractor[];
  });

/* --------------------------------- writes -------------------------------- */

export const createLandlord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => contactSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Client;
    const agency_id = await currentAgencyId(supabase);
    const { data: row, error } = await supabase
      .from("landlords")
      .insert({ agency_id, name: data.name, phone: nullify(data.phone), email: nullify(data.email) })
      .select("id, agency_id, name, phone, email, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as Landlord;
  });

export const createTenant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => contactSchema.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Client;
    const agency_id = await currentAgencyId(supabase);
    const { data: row, error } = await supabase
      .from("tenants")
      .insert({ agency_id, name: data.name, phone: nullify(data.phone), email: nullify(data.email) })
      .select("id, agency_id, name, phone, email, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as Tenant;
  });

export const createContractor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    contactSchema
      .extend({ company: z.string().trim().optional().nullable(), trade: z.string().trim().optional().nullable() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Client;
    const agency_id = await currentAgencyId(supabase);
    const { data: row, error } = await supabase
      .from("contractors")
      .insert({
        agency_id,
        name: data.name,
        company: nullify(data.company),
        trade: nullify(data.trade),
        phone: nullify(data.phone),
        email: nullify(data.email),
      })
      .select("id, agency_id, name, company, trade, phone, whatsapp, email, active, created_at, updated_at")
      .single();
    if (error) throw new Error(error.message);
    return row as Contractor;
  });

const propertyInput = z.object({
  address: z.string().trim().min(1, "Address is required"),
  postcode: z.string().trim().optional().nullable(),
  landlord_id: z.string().uuid().nullable().optional(),
  tenant_id: z.string().uuid().nullable().optional(),
});

export const createProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => propertyInput.parse(input))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Client;
    const agency_id = await currentAgencyId(supabase);
    const { data: row, error } = await supabase
      .from("properties")
      .insert({
        agency_id,
        address: data.address,
        postcode: nullify(data.postcode),
        landlord_id: data.landlord_id ?? null,
        tenant_id: data.tenant_id ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return row as { id: string };
  });

export const updateProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => propertyInput.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as Client)
      .from("properties")
      .update({
        address: data.address,
        postcode: nullify(data.postcode),
        landlord_id: data.landlord_id ?? null,
        tenant_id: data.tenant_id ?? null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

export const deleteProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as Client)
      .from("properties")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id };
  });

export const assignContractor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ property_id: z.string().uuid(), contractor_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as Client;
    const { data: existing, error: findError } = await supabase
      .from("contractor_properties")
      .select("id")
      .eq("property_id", data.property_id)
      .eq("contractor_id", data.contractor_id)
      .maybeSingle();
    if (findError) throw new Error(findError.message);
    if (existing) return { id: (existing as { id: string }).id, created: false };

    const { data: row, error } = await supabase
      .from("contractor_properties")
      .insert({ property_id: data.property_id, contractor_id: data.contractor_id })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: (row as { id: string }).id, created: true };
  });

export const unassignContractor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ link_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as Client)
      .from("contractor_properties")
      .delete()
      .eq("id", data.link_id);
    if (error) throw new Error(error.message);
    return { id: data.link_id };
  });
