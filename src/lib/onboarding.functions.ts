import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OnboardingAgency = {
  id: string;
  name: string;
  slug: string;
};

/**
 * The agency the signed-in user belongs to, or null when they have not
 * completed onboarding yet. Always resolved from the caller's own membership
 * — never from a global or fallback agency.
 */
export const getMyAgency = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingAgency | null> => {
    const { data: membership, error: memberError } = await context.supabase
      .from("agency_members")
      .select("agency_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (memberError) throw new Error(memberError.message);
    if (!membership) return null;

    const { data, error } = await context.supabase
      .from("agencies")
      .select("id, name, slug")
      .eq("id", membership.agency_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as OnboardingAgency | null) ?? null;
  });

/**
 * Creates the caller's agency and their owner membership atomically.
 *
 * Idempotent: the database routine returns the existing agency when the
 * caller already has a membership, so refreshes, retries, OAuth callback
 * repeats and double clicks cannot create duplicates.
 */
export const createMyAgency = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ name: z.string().trim().min(2).max(120) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<OnboardingAgency> => {
    const { data: rows, error } = await context.supabase.rpc(
      "create_agency_for_current_user",
      { _name: data.name },
    );
    if (error) throw new Error(error.message);
    const agency = (rows as OnboardingAgency[] | null)?.[0];
    if (!agency) throw new Error("Could not create your agency. Please try again.");
    return { id: agency.id, name: agency.name, slug: agency.slug };
  });
