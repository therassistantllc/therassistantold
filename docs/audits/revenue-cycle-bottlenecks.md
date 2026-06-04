# Revenue Cycle Bottleneck Audit

Date: 2026-06-04

## Scope

Reviewed the billing dashboard, revenue-cycle workqueue sync, workqueue actions, and workqueue claim-status handoff paths. The audit focused on defects that could slow or block charge capture, claim follow-up, denial routing, payment posting, and staff queue triage.

## Bottlenecks Found and Fixed

### 1. Workqueue sync could fail on invalid priority values

The sync route created several revenue-cycle items with `priority: "medium"`, but `workqueue_priority` only supports `low`, `normal`, `high`, and `urgent`. Any affected insert could fail the sync and stop downstream queue creation.

**Fix:** Replaced `medium` with canonical `normal` for eligibility, payment posting, mailroom, and check-in review workqueue items.

### 2. Deferred work stayed in active queues and could be duplicated

The defer action only set `deferred_until` and `defer_reason`; it did not set `status` to `deferred`. This left deferred work in active billing queues. The sync dedupe logic also ignored deferred items, so a deferred item could be recreated as a duplicate open task.

**Fix:** Added `deferred` to the workqueue status enum/constraint, set deferred items to `status: "deferred"`, and included deferred items in sync dedupe checks.

### 3. Revenue-cycle sync was not organization-scoped

The sync endpoint scanned across all organizations by default and deduped without an organization predicate. That made sync runs slower and risked cross-organization false-positive dedupe.

**Fix:** The sync endpoint now accepts `organizationId` from the query string or JSON body, falls back to `NEXT_PUBLIC_ORGANIZATION_ID`, and applies organization filters to each sync source when present. Dedupe now includes organization scope.

### 4. Professional-claim workqueue items were not consistently linked canonically

Some sync-created professional-claim follow-up items used the legacy `claim_id` column and `source_object_type: "claim"` instead of setting `professional_claim_id`. This made downstream claim actions less reliable for the canonical professional-claims workflow.

**Fix:** Professional-claim sync items now use `source_object_type: "professional_claim"` and write `professional_claim_id`.

### 5. Rejected claims were under-routed

The denial/rejection sync queried `claim_status in ("denied", "rejected")`, but the professional claim lifecycle uses `rejected_oa` and `rejected_payer`. Rejections could therefore be missed by sync-created follow-up work.

**Fix:** The sync now routes `denied`, `rejected_oa`, and `rejected_payer`; it maps those to `denied`, `clearinghouse_rejection`, and `payer_rejection` work types.

### 6. Billing dashboard counts were serial and incomplete for denials

The workflow dashboard issued many count queries serially and omitted denial workqueue counts from the action total. This made the dashboard slower and under-reported some revenue-cycle work.

**Fix:** Dashboard counts now execute in parallel using one Supabase client per request, and denial workqueue counts are included in `needsBillingAction`.

### 7. Claim-status checks ignored canonical professional claim IDs

The workqueue UI only enabled claim-status checks when `claimId` was present. Canonical billing work often sets `professionalClaimId` instead.

**Fix:** The UI now uses `professionalClaimId || claimId` for claim-status checks and labels the legacy ID distinctly.

### 8. Charge-created claims were not linked back to charge capture

The charge-to-claim bridge created professional claims but left `charge_capture_items.claim_id` empty and did not stamp `claim_created_at`. The charge queue then tried to rediscover claims by patient and appointment, which missed encounter-only charges and made generated claims appear as if no charge/claim was created.

**Fix:** The bridge now links generated or pre-existing claims back to the charge capture item, sets `claim_created_at`, passes `encounter_id` into the professional claim, and the charge-readiness APIs resolve claims by linked claim ID or encounter ID before using legacy patient/appointment matching.

### 9. Charge queue and 837P batch APIs referenced the wrong professional-claim amount column

Several billing APIs selected `professional_claims.total_charge_amount`, but the canonical professional-claim table stores the amount in `total_charge`. Those runtime selects could fail and make the charge/batch queue look empty or broken.

**Fix:** Updated charge-readiness and 837P batch APIs to select and display `professional_claims.total_charge`.

## Remaining Follow-up Recommendations

- Add an automated workqueue sync smoke test with a mocked Supabase client or a seeded local database so invalid enum values and source object types are caught before deployment.
- Consider a scheduled job to re-open deferred items when `deferred_until` is reached if operational policy requires them to return automatically to the active queue.
- Continue normalizing legacy `claim_id` paths toward `professional_claim_id` where financial FK constraints allow it.
