import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { toE164, isValidE164 } from "@/lib/phone";

export type AgencyAccount = {
  id: string;
  name: string;
  slug: string;
  notification_phone: string | null;
};

/** The agency the signed-in user belongs to, with its notification settings. */
export const getAgencyAccount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("agencies")
      .select("id, name, slug, notification_phone")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data ?? null) as AgencyAccount | null;
  });

/**
 * Saves (or clears) the agency notification mobile number. RLS restricts the
 * update to agencies the caller is a member of.
 */
export const setAgencyNotificationPhone = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ agencyId: z.string().uuid(), phone: z.string().nullable() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    let phone: string | null = null;
    if (data.phone && data.phone.trim()) {
      phone = toE164(data.phone);
      if (!phone || !isValidE164(phone)) throw new Error("Enter a valid mobile number");
    }

    const { data: row, error } = await context.supabase
      .from("agencies")
      .update({ notification_phone: phone })
      .eq("id", data.agencyId)
      .select("id, name, slug, notification_phone")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Agency not found");
    return row as AgencyAccount;
  });
