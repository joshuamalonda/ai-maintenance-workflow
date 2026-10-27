// Shared, dependency-free phone helpers. Safe to import from client and server.

/**
 * Normalises common UK input forms ("07700 900123", "44...", "0044...") to
 * E.164. Anything already international is returned as-is.
 */
export function toE164(raw: string | null | undefined): string | null {
  const value = (raw ?? "").replace(/[\s()-]/g, "").trim();
  if (!value) return null;
  if (value.startsWith("+")) return value;
  if (/^07\d{9}$/.test(value)) return `+44${value.slice(1)}`;
  if (/^447\d{9}$/.test(value)) return `+${value}`;
  if (/^00447\d{9}$/.test(value)) return `+${value.slice(2)}`;
  return value;
}

/** E.164: optional "+" then 6-15 digits. */
export function isValidE164(phone: string): boolean {
  return /^\+?[1-9]\d{5,14}$/.test(phone.trim());
}

/** Reasonable validation for an agency notification mobile number. */
export function isValidNotificationPhone(raw: string): boolean {
  const e164 = toE164(raw);
  return Boolean(e164 && isValidE164(e164));
}
