import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Sends a single test SMS to verify the Twilio outbound connection. Authenticated
 * via Supabase so only signed-in Ovelo users can trigger it. Secrets
 * (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER) are read
 * server-side only and never reach the client.
 */
export const sendTestSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        to: z
          .string()
          .regex(/^\+\d{8,15}$/, "Recipient must be an E.164 phone number, e.g. +447700900000"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { sendSms } = await import("@/lib/twilio.server");
    const result = await sendSms(data.to, "OVelo test: SMS connection is working.");
    return { ok: true, sid: result.sid, status: result.status, to: result.to, from: result.from };
  });
