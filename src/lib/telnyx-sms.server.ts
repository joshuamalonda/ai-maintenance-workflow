// Server-only helper for sending outbound SMS through Telnyx.
// Uses the existing TELNYX_API_KEY secret and the approved alphanumeric
// sender ID "OVELO" attached to the "Ovelo SMS" messaging profile.
// Never imported by client code.

const TELNYX_MESSAGES_API = "https://api.telnyx.com/v2/messages";

// Alphanumeric sender ID configured on the Ovelo SMS messaging profile.
const OVELO_SENDER_ID = "OVELO";

// E.164: optional "+" then 6-15 digits.
const E164 = /^\+?[1-9]\d{5,14}$/;

export type SendSmsResult = {
  messageId: string | null;
  status: string | null;
  raw: string | null;
};

export type SendSmsError = {
  error: string;
  status?: number;
  detail?: string;
};

/** Validates that a phone number is in E.164 format. */
export function isValidE164(phone: string): boolean {
  return E164.test(phone.trim());
}

/**
 * Sends a single outbound SMS via Telnyx using the "OVELO" alphanumeric
 * sender ID.
 *
 * @param recipient E.164 phone number (e.g. "+447700900000")
 * @param body      Message body (UTF-8, <= 1600 chars per Telnyx limit)
 */
export async function sendTelnyxSms(
  recipient: string,
  body: string,
): Promise<SendSmsResult | SendSmsError> {
  const apiKey = process.env["TELNYX_API_KEY"];

  if (!apiKey) {
    return { error: "TELNYX_API_KEY is not configured on the server." };
  }

  const to = recipient.trim();
  if (!isValidE164(to)) {
    return { error: `Recipient "${recipient}" is not a valid E.164 phone number.` };
  }

  const text = body.slice(0, 1600);

  let response: Response;
  try {
    response = await fetch(TELNYX_MESSAGES_API, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        from: OVELO_SENDER_ID,
        messaging_profile_id: "4001a039-71fa-4381-8d93-785e1031c86d",
        to,
        text,
      }),
    });
  } catch (err) {
    console.error("[telnyx-sms] network error", err);
    return { error: "Network error contacting Telnyx.", detail: String(err) };
  }

  const data = (await response.json().catch(() => null)) as {
    data?: { id?: string; status?: string } | null;
    errors?: unknown;
  } | null;

  if (!response.ok) {
    console.error("[telnyx-sms] API error", response.status, data);
    return {
      error: `Telnyx API error: ${response.status} ${response.statusText}`,
      status: response.status,
      detail: JSON.stringify(data?.errors ?? data),
    };
  }

  const message = data?.data ?? null;
  return {
    messageId: message?.id ?? null,
    status: message?.status ?? null,
    raw: JSON.stringify(data),
  };
}
