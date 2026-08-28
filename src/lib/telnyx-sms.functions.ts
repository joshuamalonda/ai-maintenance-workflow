// Thin authenticated server function wrapper around the Telnyx SMS helper.
// Lets an authenticated Ovelo user send a single outbound SMS for testing.
// No UI is wired to this yet.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendTelnyxSms, isValidE164 } from "./telnyx-sms.server";

const inputSchema = z.object({
  recipient: z
    .string()
    .min(1)
    .refine((v) => isValidE164(v), "Recipient must be a valid E.164 phone number"),
  body: z.string().min(1).max(1600),
});

export const sendTestSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => inputSchema.parse(input))
  .handler(async ({ data, context }) => {
    // Sender is the caller's own agency number; never a hardcoded sender.
    const { data: membership } = await context.supabase
      .from("agency_members")
      .select("agency_id")
      .eq("user_id", context.userId)
      .limit(1)
      .maybeSingle();
    const agencyId = (membership as { agency_id: string } | null)?.agency_id ?? null;
    const { resolveAgencySender } = await import("./telnyx-sms.server");
    const from = agencyId ? await resolveAgencySender(agencyId) : null;
    return await sendTelnyxSms(data.recipient, data.body, { from });
  });
