/**
 * Conservative post-insert matching of a maintenance case to a property in the
 * same agency's directory.
 *
 * Rules:
 *  - normalised, whitespace/punctuation-insensitive address comparison
 *  - only links on a single unambiguous match within the agency
 *  - never guesses between multiple candidates
 *  - never throws into the intake path (callers ignore failures)
 */

export function normaliseAddress(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[.,;:'"`()\[\]]/g, " ")
    .replace(/[-/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export type MatchResult =
  | {
      matched: true;
      propertyId: string;
      tenantId: string | null;
      landlordId: string | null;
    }
  | { matched: false; reason: "no-address" | "no-candidates" | "ambiguous" | "error" };

export async function matchCaseToProperty(input: {
  caseId: string;
  agencyId: string;
  propertyAddress: string | null;
}): Promise<MatchResult> {
  const target = normaliseAddress(input.propertyAddress);
  if (!target) return { matched: false, reason: "no-address" };

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data, error } = await supabaseAdmin
      .from("properties")
      .select("id, address, postcode, tenant_id, landlord_id")
      .eq("agency_id", input.agencyId);
    if (error || !data) return { matched: false, reason: "error" };

    // A case address matches either the stored address alone, or the stored
    // address plus its postcode (intake commonly sends "<address>, <postcode>").
    const candidates = data.filter((p) => {
      const address = normaliseAddress(p.address);
      if (!address) return false;
      if (address === target) return true;
      const postcode = normaliseAddress(p.postcode);
      return Boolean(postcode) && `${address} ${postcode}` === target;
    });
    if (candidates.length === 0) return { matched: false, reason: "no-candidates" };
    if (candidates.length > 1) return { matched: false, reason: "ambiguous" };

    const property = candidates[0]!;
    const { error: updateError } = await supabaseAdmin
      .from("maintenance_cases")
      .update({ property_id: property.id, tenant_id: property.tenant_id ?? null })
      .eq("id", input.caseId)
      .eq("agency_id", input.agencyId);
    if (updateError) return { matched: false, reason: "error" };

    return {
      matched: true,
      propertyId: property.id,
      tenantId: property.tenant_id ?? null,
      landlordId: property.landlord_id ?? null,
    };
  } catch {
    return { matched: false, reason: "error" };
  }
}
