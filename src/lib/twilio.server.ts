// Server-only helpers for sending outbound SMS via the Twilio REST API.
// Secrets are read inside each function so they never reach the client bundle.

export type SendSmsResult = {
  sid: string;
  status: string;
  to: string;
  from: string;
};

export type SendSmsError = {
  status: number;
  code?: number;
  message: string;
};

function getConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  const missing = [
    ...(!accountSid ? ["TWILIO_ACCOUNT_SID"] : []),
    ...(!authToken ? ["TWILIO_AUTH_TOKEN"] : []),
    ...(!fromNumber ? ["TWILIO_PHONE_NUMBER"] : []),
  ];
  if (missing.length > 0) {
    throw new Error(`Missing Twilio secret(s): ${missing.join(", ")}`);
  }
  return { accountSid: accountSid!, authToken: authToken!, fromNumber: fromNumber! };
}

/**
 * Sends a single SMS via the Twilio Messages REST endpoint using HTTP Basic
 * auth (Account SID + Auth Token). Returns the message SID on success.
 */
export async function sendSms(to: string, body: string): Promise<SendSmsResult> {
  const { accountSid, authToken, fromNumber } = getConfig();

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ To: to, From: fromNumber, Body: body }),
  });

  const payload = (await response.json().catch(() => null)) as {
    sid?: string;
    status?: string;
    to?: string;
    from?: string;
    code?: number;
    message?: string;
    error_message?: string;
    error_code?: number;
  } | null;

  if (!response.ok) {
    const message = payload?.message ?? payload?.error_message ?? `Twilio request failed with status ${response.status}`;
    console.error("[twilio] send failed", response.status, payload);
    const err: SendSmsError = {
      status: response.status,
      code: payload?.code ?? payload?.error_code,
      message,
    };
    throw new Error(`Twilio error [${err.status}${err.code ? ` / ${err.code}` : ""}]: ${err.message}`);
  }

  return {
    sid: payload?.sid ?? "",
    status: payload?.status ?? "queued",
    to: payload?.to ?? to,
    from: payload?.from ?? fromNumber,
  };
}
