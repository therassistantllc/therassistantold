# THERASSISTANT EHR — Claim Routing Normalization

**Status:** Active guidance · Non-destructive · Build-safe  
**Last updated:** 2026-05-15  
**Companion file:** [`lib/claims/claimRouting.ts`](../lib/claims/claimRouting.ts)

---

## Overview

Two parallel claim paths currently exist in the database. This document
classifies every table and every file that touches claims so that developers
can make informed routing decisions without accidentally writing to the wrong
table.

> **No tables have been deleted or renamed.** This document + the routing
> constants file are the normalization layer. Destructive migrations come later,
> after every affected route is verified.

---

## Canonical Claim Workflow

All new claim creation, EDI 837P batching, status tracking, and ERA payment
matching for new claims must use this path.

```
encounters
  └── professional_claims          ← claim header
        ├── professional_claim_service_lines  ← line items
        ├── claim_status_events               ← audit trail
        ├── claim_parties_snapshot            ← payer/provider snapshot at submit
        ├── claim_workqueue_items             ← workqueue entries
        └── era_claim_payments                ← ERA payment records (via professional_claim_id)

workqueue_items.professional_claim_id → professional_claims
tickets.claim_id                      → professional_claims
patient_invoices.professional_claim_id→ professional_claims
```

**New claim creation rule:** Every new claim MUST be inserted into
`professional_claims`. Use `getPreferredClaimTable()` from
`lib/claims/claimRouting.ts` to resolve the table name.

**Claim detail UI rule:** Claim detail pages (billing workspace, claim
readiness, workqueue) must read from `professional_claims`. They already do
as of the 2026-05 audit.

**Workqueue rule:** `workqueue_items.professional_claim_id` references
`professional_claims`. The `professionalClaimAgingWorkqueueService` and
`claimRejectionWorkqueueService` are already canonical. No action needed.

**ERA / payment posting rule:** New ERA (835) matching must resolve
`era_claim_payments.professional_claim_id`. Services in `lib/payments/`
(`era835PostingService`, `era835IntakeService`) already target
`professional_claims`.

---

## Legacy Claim Workflow

The legacy path was created before the EDI 837P foundation. It is preserved
because several financial FK chains cannot be trivially re-pointed.

```
encounters
  └── claims                   ← legacy claim header
        ├── claim_service_lines            ← legacy line items
        ├── claim_submissions              ← legacy submission log
        └── claim_status_inquiries         ← legacy payer status

payment_import_items.claim_id        → claims  (FK constraint)
payment_posting_allocations.claim_id → claims  (FK constraint)
documents.claim_id                   → claims  (FK constraint)
vcc_payments.claim_id                → claims  (FK constraint)
kpi_claim_summary                    reads claims (view/materialized)
```

**Legacy read rule:** Code that serves existing payment records (VCC
payments, payment posting allocations, documents attached to old claims)
MUST continue reading `claims` for those records. Do not attempt to
re-point these FKs until a formal migration with data-backfill is planned.

---

## Table-by-Table Classification

| Table | Path | Status |
|---|---|---|
| `professional_claims` | Canonical | Preferred — use for all new claims |
| `professional_claim_service_lines` | Canonical | Preferred — use for all new service lines |
| `claim_status_events` | Canonical | Preferred — audit trail for canonical claims |
| `claim_parties_snapshot` | Canonical | Preferred — payer/provider snapshot |
| `claim_workqueue_items` | Canonical | Preferred — workqueue for canonical claims |
| `era_claim_payments` | Canonical | Preferred — ERA payments via `professional_claim_id` |
| `workqueue_items` | Canonical | Uses `professional_claim_id` FK |
| `tickets` | Canonical | Uses `claim_id → professional_claims` FK |
| `patient_invoices` | Canonical | Uses `professional_claim_id` FK |
| `claims` | Legacy | Preserved — do not delete |
| `claim_service_lines` | Legacy | Preserved — do not delete |
| `claim_submissions` | Legacy | Preserved — submission log for legacy path |
| `claim_status_inquiries` | Legacy | Preserved — payer status for legacy path |
| `payment_import_items` | Legacy | FK to `claims` — must remain on legacy path |
| `payment_posting_allocations` | Legacy | FK to `claims` — must remain on legacy path |
| `documents` | Legacy | FK to `claims` — must remain on legacy path |
| `vcc_payments` | Legacy | FK to `claims` — must remain on legacy path |
| `kpi_claim_summary` | Legacy | View reads `claims` — legacy reporting |

---

## VCC / Document Compatibility Note

`vcc_payments`, `payment_posting_allocations`, and `documents` all carry a
`claim_id` foreign key that points to `claims`, not `professional_claims`.
These constraints exist in the live schema and cannot be changed without:

1. Adding a parallel `professional_claim_id` nullable FK column to each table.
2. Backfilling values for every historical record that has a known match.
3. Updating payment-posting and mailroom code to write the new column.
4. Deprecating the old `claim_id` column after a cutover window.

Until that migration runs, any code that reads VCC payments or document
attachments for a claim must JOIN through `claims`, not `professional_claims`.

---

## Migration Strategy

### Phase 1 — Routing constants (complete)
- `lib/claims/claimRouting.ts` created.
- No runtime behavior changed.

### Phase 2 — New-claim enforcement
- Update `app/api/claims/create-from-encounter/route.ts` to write
  `professional_claims` (and `professional_claim_service_lines`).
- Update `lib/ehr/pipeline.ts` claim creation block similarly.
- Both files currently write to `claims` — they are the highest priority
  migration targets.

### Phase 3 — Workqueue sync migration
- Update `app/api/workqueue/sync/route.ts` to read from `professional_claims`.
  It currently reads `claims` for status sync, creating drift.

### Phase 4 — Workflow engine migration
- `lib/workflow/workflowFunctions.ts` and `lib/workflow/workflowActions.ts`
  both read/write `claims`. Migrate after Phase 2 so new rows already exist
  in `professional_claims`.

### Phase 5 — Clearinghouse / payment dual-lookup
- `lib/clearinghouse/ClearinghouseService.ts`, `OfficeAllyJsonApiAdapter.ts`,
  and the ERA 835 routes currently resolve claims from `claims`. Once Phase 2
  is done, these need a compatibility fallback: try `professional_claims`,
  fall back to `claims` for historical records. Use `CLAIM_ROUTE_MODE.compatibility`.

### Phase 6 — FK re-pointing (future, planned migration)
- Add `professional_claim_id` columns to `payment_posting_allocations`,
  `vcc_payments`, `documents`.
- Backfill, then cut over writers.
- Mark `claims.id` FK columns as deprecated.

### Phase 7 — Legacy table archival (far future)
- After all FK chains point to `professional_claims` and all reads/writes
  are migrated, archive `claims` and related legacy tables.
- Requires explicit sign-off. Do not perform without full regression test.

---

## What Not to Delete Yet

Do not drop any of the following tables or columns until Phase 6+ is complete:

- `claims`
- `claim_service_lines`
- `claim_submissions`
- `claim_status_inquiries`
- `payment_import_items.claim_id`
- `payment_posting_allocations.claim_id`
- `documents.claim_id`
- `vcc_payments.claim_id`
- `kpi_claim_summary` (view — legacy reporting dashboard depends on it)

---

## Codebase Audit Results (2026-05-15)

### Already Canonical — no action needed

These files already use `professional_claims` and `professional_claim_service_lines`
exclusively. They should be considered the reference implementation.

| File | Notes |
|---|---|
| `app/api/billing/workflow-dashboard/route.ts` | Counts by status via `professional_claims` |
| `app/api/billing/837p-batches/route.ts` | Reads EDI batches from `professional_claims` |
| `app/api/billing/claim-readiness/route.ts` | Readiness checks against `professional_claims` |
| `app/api/billing/claim-readiness/create-837p-batch/route.ts` | Batch creation via `professional_claims` |
| `app/api/patients/[clientId]/claims/route.ts` | Patient claim list from `professional_claims` |
| `lib/claims/claimReadinessService.ts` | Core readiness service — canonical |
| `lib/claims/chargeCaptureClaimBridgeService.ts` | Bridge from charges to `professional_claims` |
| `lib/claims/edi837pBatchService.ts` | 837P batch builder — canonical |
| `lib/claims/edi837pSubmissionService.ts` | 837P submission — canonical |
| `lib/claims/edi277caAcknowledgementService.ts` | 277CA handler — canonical |
| `lib/claims/edi999AcknowledgementService.ts` | 999 handler — canonical |
| `lib/workqueue/professionalClaimAgingWorkqueueService.ts` | Aging workqueue — canonical |
| `lib/workqueue/claimRejectionWorkqueueService.ts` | Rejection workqueue — canonical |
| `lib/payments/era835PostingService.ts` | ERA posting via `professional_claims` |
| `lib/payments/era835IntakeService.ts` | ERA intake via `professional_claims` |
| `app/api/edi/office-ally/837p/generate/route.ts` | EDI file generation — canonical |
| `scripts/test-claim-readiness-workflow.ts` | Test script — canonical |
| `scripts/test-837p-submission-workflow.ts` | Test script — canonical |
| `scripts/test-277ca-acknowledgement-workflow.ts` | Test script — canonical |
| `scripts/test-999-acknowledgement-workflow.ts` | Test script — canonical |
| `scripts/test-837p-batch-workflow.ts` | Test script — canonical |
| `scripts/test-professional-claim-aging-workqueue.ts` | Test script — canonical |

### Should Remain Legacy Readonly — do not migrate yet

These files interact with `claims` because the downstream FK chains require it
or they are replaying historical records.

| File | Notes |
|---|---|
| `supabase/functions/parse-835-batch/index.ts` | Matches ERA remits against legacy `claims`; also writes `payment_import_items` (FK → `claims`) |
| `app/api/payments/client/route.ts` | Posts payments against legacy `claims`; `payment_posting_allocations` FK forces this |
| `app/api/payments/post/route.ts` | Same FK constraint as above |
| `app/api/payments/insurance/route.ts` | Same FK constraint; also reads legacy claim balance |
| `app/api/payments/import-835/route.ts` | Imports ERA into `payment_import_items` (FK → `claims`) |
| `lib/canonical-ehr/seed.ts` | Seed data includes `claim_submissions` (legacy struct) |
| `lib/canonical-ehr/types.ts` | Type model includes `claim_submissions` array |
| `lib/canonical-ehr/model.ts` | State reducer appends to `claim_submissions` |

### Needs Migration to `professional_claims` — Phase 2–4 priority

These files create or mutate claims using the legacy path. They are the direct
cause of data drift between the two claim paths.

| File | Notes |
|---|---|
| `app/api/claims/create-from-encounter/route.ts` | **Highest priority.** Creates new `claims` rows. Should create `professional_claims` instead. |
| `lib/ehr/pipeline.ts` | Creates `claims` and `claim_service_lines` from encounter data. Phase 2 migration target. |
| `app/api/workqueue/sync/route.ts` | Reads `claims` for workqueue sync. After Phase 2, claims will only exist in `professional_claims`. |
| `lib/workflow/workflowFunctions.ts` | Reads `claims` and `claim_service_lines` for workflow evaluation. Phase 4 migration target. |
| `lib/workflow/workflowActions.ts` | Writes claim status updates to `claims`. Phase 4 migration target. |
| `app/api/lifecycle/run-full-flow/route.ts` | Full-flow test route that seeds and reads `claims`. Migrate after service layer migrates. |
| `scripts/test-complete-workflow.ts` | Test script uses legacy `claims`. Update after service layer migrates. |

### Manual Review — routing decision required before migration

These files have mixed or unclear claim routing. A developer must inspect each
and decide between `CLAIM_ROUTE_MODE.compatibility` (dual lookup) or a clean
cut to canonical.

| File | Notes |
|---|---|
| `lib/clearinghouse/ClearinghouseService.ts` | Submits and reads `claims`; must handle both old and new claims during transition. Recommend compatibility mode. |
| `lib/clearinghouse/adapters/OfficeAllyJsonApiAdapter.ts` | Reads `claims` for clearinghouse submission status. Needs dual-lookup during transition. |
| `app/api/clearinghouse/office-ally/era-835/route.ts` | ERA matching reads `claims`. Needs dual-lookup until all claims are in `professional_claims`. |
| `app/api/settings/system-readiness/route.ts` | Already detects dual-table confusion (line 157). Update its guidance text after Phase 2. |

---

## Using `claimRouting.ts`

```typescript
import {
  getPreferredClaimTable,
  getPreferredClaimServiceLineTable,
  isCanonicalClaimTable,
  isLegacyClaimTable,
  CLAIM_ROUTE_MODE,
  CANONICAL_CLAIM_TABLE,
  LEGACY_CLAIM_TABLE,
} from "@/lib/claims/claimRouting";

// New claim insert
const { data } = await supabase
  .from(getPreferredClaimTable())
  .insert(payload);

// Guard in a service
if (isLegacyClaimTable(tableName)) {
  console.warn(`[claim-routing] Unexpected legacy table access: ${tableName}`);
}

// Route mode annotation (documentation only, not enforced at runtime yet)
// routeMode: CLAIM_ROUTE_MODE.canonical
```
