# Inspection: automatic tenant + landlord SMS on case creation

## Where a case is created

There is exactly one intake path: `POST /api/public/cases`
(`src/routes/api/public/cases.ts`).

Flow inside the handler:
1. Bearer key check (`CASE_INGEST_KEY`)
2. Zod validation of the payload
3. Agency resolution from the destination endpoint (`channel_endpoints`)
4. Channel resolution + transcript normalisation
5. `supabaseAdmin.insert(...)` into `maintenance_cases`, returning
   `id, reference_code`
6. Best-effort `matchCaseToProperty(...)` from `src/lib/matching.server.ts`,
   wrapped in try/catch — never affects the intake result
7. `201 { ok: true, case }`

Step 6 is the only place where the case becomes linked to a property/tenant,
so it is the natural anchor for notifications.

## Data available at creation time

| Field | Available? | Source |
|---|---|---|
| Case reference code | Yes | returned by the insert (`reference_code`, auto `MC-000001`) |
| Property address | Yes | `property_address` from the payload (free text) |
| Issue summary/description | Yes | `issue_description`, `ai_summary`, `issue_category`, `urgency` |
| Tenant phone | Conditional | only via the directory: matched `property.tenant_id` → `tenants.phone`. The raw `caller_number` exists on phone calls but is nulled for WhatsApp and is not a directory record. |
| Landlord phone | Conditional | only via matched `property.landlord_id` → `landlords.phone` |

Key constraint: `matchCaseToProperty` is deliberately conservative — it links
only on a single exact normalised-address match within the agency. It returns
`no-candidates` / `ambiguous` otherwise. So for an unmatched case there is **no
tenant or landlord phone number at all**, and no SMS can be sent.

The current select in `matchCaseToProperty` fetches `id, address, tenant_id`
only — `landlord_id` is not selected today.

## Outbound SMS helper

- `src/lib/telnyx-sms.server.ts` → `sendTelnyxSms(recipient, body)`
  - `POST https://api.telnyx.com/v2/messages`
  - auth: `Bearer process.env.TELNYX_API_KEY`
  - `from: "OVELO"` (approved alphanumeric sender ID, hardcoded)
  - `messaging_profile_id: "4001a039-71fa-4381-8d93-785e1031c86d"` (required
    because alphanumeric senders carry no profile)
  - validates E.164 via `isValidE164`, truncates body to 1600 chars
  - returns `SendSmsResult | SendSmsError` — never throws
- `src/lib/telnyx-sms.functions.ts` → `sendTestSms`, an authenticated
  `createServerFn` wrapper. Not wired to any UI. It is a test surface only and
  is not the right caller for intake (intake is unauthenticated).

Note: alphanumeric sender IDs are one-way — replies are not deliverable. Fine
for confirmations, not for a contractor accept/decline reply flow later.

## Smallest safe integration point

Inside the existing best-effort block in `src/routes/api/public/cases.ts`,
right after `matchCaseToProperty` returns `matched: true`, call one new
server-only helper (e.g. `src/lib/case-notifications.server.ts`) that:

1. Loads `tenants.phone` and `landlords.phone` for the matched property with
   `supabaseAdmin`
2. Sends at most two SMS via `sendTelnyxSms`
3. Swallows every error (logs only), so intake keeps returning 201

This requires one small change to `matchCaseToProperty` (also select
`landlord_id` and return it) or a separate single admin read of the property.
Everything else is additive. No schema change is strictly required.

## Blockers / gaps to accept before building

- No SMS is sent when the address does not match a directory property. Expect
  low coverage until the agency's properties are loaded.
- Phone numbers in `tenants`/`landlords` are free text; `isValidE164` will
  reject anything not in E.164, so those sends silently no-op.
- No delivery/idempotency record. A retried intake POST creates a new case and
  therefore a new SMS pair — acceptable, but there is no "already notified"
  flag. Adding one would need a schema change (out of scope for the minimum).
- Sends are synchronous inside the request; two Telnyx calls add ~200–600ms to
  intake latency. Acceptable, and failures are non-fatal.
- Each SMS costs ~$0.04.

## Proposed next build (one step, minimal)

1. `src/lib/case-notifications.server.ts` — `notifyCaseCreated({ caseId,
   agencyId, propertyId, referenceCode, propertyAddress, issueSummary })`
2. Extend `matchCaseToProperty` to also return `landlordId`
3. Call the notifier from the existing try/catch in the intake route
4. Message copy:
   - Tenant: "Ovelo: your maintenance request has been logged. Reference
     {ref}. We'll be in touch."
   - Landlord: "Ovelo: a maintenance request has been logged for {address}.
     Reference {ref}."
5. Verify with one real intake POST against a matched test property.

No UI, no database migration, no new secrets.
