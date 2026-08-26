# OVELO Audit vs the Ger Real Estate Workflow

No code changed. Findings are based on reading the live schema, notification helpers, case/property/contractor screens, and the current production data (1 agency, 1 property, 4 tenants, 4 landlords, 1 contractor, 1 live case).

## 1. What already works and must not be touched

- **Intake pipeline (phone + WhatsApp).** Strict endpoint→agency resolution, server-verified Telnyx destination, channel decided from backend signals only, auto reference codes (`MC-000001`), transcript normalisation, post-call enrichment (recording + transcript backfill). This is the hardest part of the product and it works.
- **Multi-tenant isolation.** Everything is scoped by `agency_id` with RLS via `agency_members`; `maintenance_cases` is insert/update-denied to app users and only written through verified server functions. Do not loosen this.
- **Property directory + fuzzy auto-matching.** Normalisation, postcode and occupant-name signals, confidence threshold with a runner-up gap. Conservative by design — leave the thresholds alone until real misses appear.
- **Best-effort notification discipline.** Every SMS is wrapped so a Telnyx failure can never roll back a link, assignment, or acceptance. `case_created_notified_at` is a real DB-level one-time claim. Keep this pattern for anything new.
- **Case detail page content.** Summary, issue, recommended action, transcript, recording player, linked property/tenant/landlord, contractor panel. Information density is right.

## 2. What is missing from Ger's workflow

Ranked by how much they break the intended flow.

1. **No "agency reviews, then intentionally opens/notifies the case" step.** Today tenant + landlord SMS fire automatically the moment auto-matching succeeds. Ger's flow requires a human gate. This is the single biggest divergence: the agency currently cannot stop a bad AI-captured case from texting a landlord.
2. **Case status is dead metadata.** Nothing in the app ever changes `status`. Live proof: the one real case is assigned, accepted, and has a confirmed appointment — and is still `needs_attention`. The three dashboard sections therefore cannot reflect reality, and "Completed" is unreachable.
3. **No landlord decision capture.** "Landlord handles it themselves" vs "send a contractor" exists only in SMS prose. There is no field, no button, and no way to close a case as landlord-handled.
4. **No final confirmation to tenant and landlord.** On appointment confirmation only the *contractor* is texted. The tenant — the person who has to be home — gets nothing after the initial "logged" message. This is the most visible failure to the end user.
5. **Contractor accept/decline is agency-simulated.** The buttons are internal test controls; the contractor cannot respond from their phone. Acceptable for MVP only if the agency knows they are recording a phone/WhatsApp reply manually.
6. **No case timeline.** There is no record of who did what and which SMS went out. With SMS as the main side effect, "did the landlord get told?" is currently unanswerable inside OVELO.

## 3. Redundant / complexity without payoff

- **Duplicate `Reported` and `Created at` fields** on case detail render the identical timestamp. Remove one.
- **Six agency SMS milestones.** `contractor_unassigned` and `property_linked` notify the agency about actions the agency itself just performed in the UI. Pure noise; the useful ones are case created, contractor accepted, contractor declined.
- **Conversation ID / call reference exposed as first-class fields.** Debug data in the operator's primary panel.
- **`priority` alongside `urgency`.** Two AI-supplied severity fields, no defined difference, no filtering behind either.
- **`contractor_required` flag** displayed but never acted on.
- **Contractor delete + property delete with case-unlinking.** Correctly built, but destructive admin actions Ger will rarely use; they widen the surface where case history can be silently detached.
- **Overview dashboard vs Maintenance cases list.** Two near-identical views of the same small dataset. For one agency with single-digit open cases, the overview earns little.

## 4. Small changes with real productivity payoff

These are the only things worth building before Ger uses it.

- **A) Make status real and driven by the workflow.** Set `in_progress` when a contractor is assigned, `completed` when the agency marks the job done, plus a manual status control on the case. Without this the dashboard lies.
- **B) Gate tenant/landlord notification behind an explicit "Open case & notify" button.** Reuse the existing `claimCaseCreatedNotification` claim and the existing message templates — it becomes a manual trigger instead of an automatic one. Matches Ger's flow exactly and prevents wrong-address texts.
- **C) Send the tenant (and landlord) the appointment confirmation** alongside the existing contractor SMS. One extra call in the existing appointment path.
- **D) Landlord decision as two buttons on the case** ("Landlord handling" / "Send contractor"). Landlord-handling closes the case; send-contractor reveals the existing assignment panel. Small field, large clarity gain.
- **E) Notification log on the case.** Record every SMS sent (who, what, when, delivered/failed) and show it as a timeline. Turns "I think they were told" into evidence, and makes support of the first agency tractable.
- **F) Trim the noise:** drop the duplicate timestamp, move conversation/call IDs behind a collapsed "Technical details", and cut the two self-referential agency SMS.

## 5. Defer until after Ger uses it

- Contractor-facing accept/decline links or inbound SMS keyword handling (real two-way contractor comms).
- Email notifications and per-event notification preferences.
- Arthur integration or sync of any kind.
- Reporting, SLA timers, response-time analytics.
- Bulk import of properties/tenants/landlords, multi-user agency roles and invites.
- Case notes/attachments/photos.
- Any tuning of the fuzzy matcher.

## 6. Recommendation

**Make a few changes, then ship.** The intake and multi-tenant foundation is production-grade; the gap is entirely in the middle of the workflow — the agency's control over the case lifecycle. Shipping as-is means Ger sees every case stuck in "Needs attention" forever, tenants who never learn when the contractor is coming, and landlord SMS firing without a human check.

Build **A, B, C, D** (workflow control + the missing tenant confirmation) as one focused pass, and treat **E** (notification log) as the immediate follow-up if Ger asks "did they get it?" more than once. Everything in section 5 waits for real usage.

## Technical notes

- `maintenance_cases.status` currently has no writer anywhere in `src/lib/cases.functions.ts` — adding one means a new admin-client server function following the existing verify-then-update pattern.
- A landlord decision needs one nullable column (e.g. `landlord_decision`), not a new table.
- The notification log needs one new table scoped by `agency_id` with the standard grants + RLS (read-only to agency members, written by the admin client inside `case-notifications.server.ts`).
- Notification gating requires no schema change: `case_created_notified_at` already provides the one-time claim; the trigger just moves from intake to a user action.
