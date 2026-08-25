import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { Database } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export type Contractor = Database["public"]["Tables"]["contractors"]["Row"];
export type Property = Database["public"]["Tables"]["properties"]["Row"];

type Client = SupabaseClient<Database>;

const CONTRACTOR_COLUMNS =
  "id, agency_id, name, company, trade, phone, whatsapp, email, active, created_at, updated_at";

const nullify = (v?: string | null) => {
  const t = (v ?? "").trim();
  return t.length ? t : null;
};

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

const contractorInput = z.object({
  name: z.string().trim().min(1, "Contact name is required"),
  company: z.string().trim().optional().nullable(),
  trade: z.string().trim().optional().nullable(),
  phone: z.string().trim().optional().nullable(),
  whatsapp: z.string().trim().optional().nullable(),
  email: z.string().trim().optional().nullable(),
  active: z.boolean().optional(),
});

/* ---------------------------------- read --------------------------------- */

export const listAgencyContractors = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as Client)
      .from("contractors")
      .select(CONTRACTOR_COLUMNS)
      .order("name");
    if (error) throw new Error(error.message);
    return (data ?? []) as Contractor[];
  });

export type ContractorDetail = {
  contractor: Contractor;
  properties: Array<{
    linkId: string;
    property: Pick<Property, "id" | "address" | "postcode">;
  }>;
};

export const getContractor = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ContractorDetail | null> => {
    const supabase = context.supabase as Client;

    const { data: contractor, error } = await supabase
      .from("contractors")
      .select(CONTRACTOR_COLUMNS)
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!contractor) return null;

    const { data: links, error: linkError } = await supabase
      .from("contractor_properties")
      .select("id, property:properties(id, address, postcode)")
      .eq("contractor_id", data.id);
    if (linkError) throw new Error(linkError.message);

    return {
      contractor: contractor as unknown as Contractor,
      properties: (links ?? [])
        .map((l) => ({
          linkId: (l as { id: string }).id,
          property: (l as unknown as { property: Pick<Property, "id" | "address" | "postcode"> })
            .property,
        }))
        .filter((l) => Boolean(l.property))
        .sort((a, b) => a.property.address.localeCompare(b.property.address)),
    };
  });

/* --------------------------------- writes -------------------------------- */

export const createAgencyContractor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => contractorInput.parse(input))
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
        whatsapp: nullify(data.whatsapp),
        email: nullify(data.email),
        active: data.active ?? true,
      })
      .select(CONTRACTOR_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as Contractor;
  });

export const updateAgencyContractor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => contractorInput.extend({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as Client)
      .from("contractors")
      .update({
        name: data.name,
        company: nullify(data.company),
        trade: nullify(data.trade),
        phone: nullify(data.phone),
        whatsapp: nullify(data.whatsapp),
        email: nullify(data.email),
        ...(data.active === undefined ? {} : { active: data.active }),
      })
      .eq("id", data.id)
      .select(CONTRACTOR_COLUMNS)
      .single();
    if (error) throw new Error(error.message);
    return row as unknown as Contractor;
  });

export const setContractorActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), active: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as Client)
      .from("contractors")
      .update({ active: data.active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { id: data.id, active: data.active };
  });

export const assignContractorToProperty = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ contractor_id: z.string().uuid(), property_id: z.string().uuid() }).parse(input),
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
    if (error) {
      // Unique constraint: the link was created concurrently — treat as success.
      if (error.code === "23505") return { id: "", created: false };
      throw new Error(error.message);
    }
    return { id: (row as { id: string }).id, created: true };
  });

export const unassignContractorFromProperty = createServerFn({ method: "POST" })
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
