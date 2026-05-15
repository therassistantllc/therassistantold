# THERASSISTANT EHR — Workqueue Claim Routing

**Status:** Active guidance · Non-destructive · Build-safe  
**Last updated:** 2026-05-15  
**Companion file:** [`lib/workqueue/workqueueClaimRouting.ts`](../lib/workqueue/workqueueClaimRouting.ts)  
**See also:** [`docs/claim-routing-normalization.md`](./claim-routing-normalization.md)

---

## Overview

`workqueue_items` carries **two** claim reference columns that reflect the
parallel claim paths currently in the database:

| Column | FK target | Status |
|---|---|---|
| `professional_claim_id` | `professional_claims` | **Canonical — prefer for all new work** |
| `claim_id` | `claims` | Legacy — backward-compat only, read-only for new code |

This document defines how each column should be used, which pages and services
are already correct, and which must migrate.

> **No columns are deleted. No tables are renamed. No data is migrated.**
> This document + the routing utility file are the normalization layer.

---

## Canonical Workqueue Behavior

A workqueue item is **canonical** when:

1. It is sourced from a `professional_claims` row.
2. `professional_claim_id` is populated with the `professional_claims.id`.
3. `claim_id` is `null` or absent.
4. UI claim detail links resolve through `/billing/claim-readiness` or
   equivalent canonical claim detail page.

All new workqueue inserts for claim-related work types (`clearinghouse_rejection`,
`payer_rejection`, `era_mismatch`, `era_exception`, `aging_0_30`…`aging_120_plus`)
**must** set `professional_claim_id`. Use `canonicalClaimColumns()` from
`lib/workqueue/workqueueClaimRouting.ts` to generate the correct column set.

---

## Preferred Claim Lookup Order

When resolving which claim a workqueue item references — for display,
drill-down links, or service calls — use the following precedence:

```
1. professional_claim_id  →  query professional_claims
2. claim_id               →  query claims  (legacy fallback only)
3. null                   →  item has no claim link
```

Use `resolveWorkqueueClaimTarget(item)` from `lib/workqueue/workqueueClaimRouting.ts`
to perform this resolution in a single call.

```ts
import { resolveWorkqueueClaimTarget } from "@/lib/workqueue/workqueueClaimRouting";

const { table, claimId, isCanonical } = resolveWorkqueueClaimTarget(item);
if (table && claimId) {
  const claim = await supabase.from(table).select("*").eq("id", claimId).single();
}
```

---

## How `professional_claim_id` Should Be Used

- **Insert:** Always populate when the workqueue item is linked to a
  `professional_claims` row. Use `canonicalClaimColumns(claim.id)`.
- **Query:** Prefer `.eq("professional_claim_id", id)` over `.eq("claim_id", id)`
  when checking for duplicate open items on canonical claims.
- **UI:** Render claim detail links using `professionalClaimId` from the DTO.
  Gate canonical-only actions (e.g., re-submit 837P) on `hasProfessionalClaimReference()`.
- **Deduplication:** `professionalClaimAgingWorkqueueService` and
  `claimRejectionWorkqueueService` both guard against duplicate items using
  `source_object_type = "professional_claim"` and `source_object_id = claim.id`.
  Maintain this pattern for all new canonical services.

---

## How `claim_id` Should Be Treated

- **Read:** Safe to read for items where `professional_claim_id` is null.
  These are legacy-path items (VCC payments, payment import items, legacy
  denial/no-response syncs).
- **Write (new code):** Do NOT write `claim_id` alone in new workqueue inserts.
  Always prefer `professional_claim_id`. If the source is a legacy `claims` row,
  use `legacyClaimColumns(claim.id)` and leave a `// TODO: migrate` comment.
- **Gradual deprecation:** As source tables (`claims`, `payment_import_items`,
  `vcc_payments`) migrate to reference `professional_claims`, the corresponding
  workqueue sync code should switch to `canonicalClaimColumns()`.

---

## Compatibility Strategy

During the migration window both columns will be in use. Code that must handle
items from either path (e.g., the workqueue list UI, the items API) should:

1. Expose **both** `professionalClaimId` and `claimId` in DTOs (already done
   in `/api/workqueue/items` and `/api/patients/[clientId]/workqueue`).
2. Use `resolveWorkqueueClaimTarget()` to pick the right table at runtime.
3. Render UI hints distinguishing canonical from legacy items where useful.

Services that only ever create canonical items (EDI acknowledgement handlers,
ERA services) do not need compatibility logic — they should be canonical-only.

---

## Migration Strategy

### Phase 1 — Routing utilities (complete)
- `lib/workqueue/workqueueClaimRouting.ts` created.
- No runtime behavior changed.

### Phase 2 — Fix workqueue action gate in WorkqueueClient.tsx
- `app/workqueue/WorkqueueClient.tsx` line 141 gates claim actions on
  `item.claimId` (legacy). After Phase 2 claim creation migrates to
  `professional_claims`, this gate should also check `professionalClaimId`.
- Change: `if (!item.claimId || !item.clientId)` →
  `if (!getCanonicalClaimReference(item) || !item.clientId)`

### Phase 3 — Migrate workqueue sync for no_response / denial_followup
- `app/api/workqueue/sync/route.ts` reads `claims` for `no_response` and
  `denial_followup` items (lines ~147–212). After claim creation moves to
  `professional_claims` (claim routing Phase 2), update this sync to read
  `professional_claims` instead and use `canonicalClaimColumns()`.

### Phase 4 — Migrate workflow engine inserts
- `lib/workflow/workflowFunctions.ts` and `lib/workflow/workflowActions.ts`
  create workqueue items with `claim_id`. Migrate after Phase 3.

### Phase 5 — Migrate payment/VCC workqueue items
- `app/api/workqueue/sync/route.ts` creates `payment_posting_needed` and
  `vcc_processing` items with `claim_id` sourced from `payment_import_items`
  and `vcc_payments`. These carry legacy FK constraints. Migrate after the
  FK re-pointing migration in claim-routing-normalization.md Phase 6.

---

## Which Pages Should Migrate First

Priority order (highest impact, lowest risk first):

| Priority | File | Change needed |
|---|---|---|
| **1** | `app/workqueue/WorkqueueClient.tsx` | Gate claim actions on `getCanonicalClaimReference()` instead of `claimId` only |
| **2** | `app/api/workqueue/sync/route.ts` | Switch `no_response` and `denial_followup` to read `professional_claims` (after claim creation migrates) |
| **3** | `lib/workflow/workflowFunctions.ts` | Replace `claim_id` inserts with `canonicalClaimColumns()` |
| **4** | `lib/workflow/workflowActions.ts` | Same as above |
| **5** | `app/api/lifecycle/run-full-flow/route.ts` | Dev/test route — migrate after service layer |
| **6** | `app/api/workqueue/sync/route.ts` | `payment_posting_needed` / `vcc_processing` items — migrate only after FK re-pointing |

---

## Codebase Audit Results (2026-05-15)

### Already Canonical — no action needed

These files create or query workqueue items using `professional_claim_id`
exclusively. They are the reference implementation.

| File | Notes |
|---|---|
| `lib/workqueue/claimRejectionWorkqueueService.ts` | Inserts `professional_claim_id: claim.id`; reads `professional_claims` |
| `lib/workqueue/professionalClaimAgingWorkqueueService.ts` | Inserts `professional_claim_id: claim.id`; deduplicates via `source_object_type = "professional_claim"` |
| `lib/workqueue/eraMismatchWorkqueueService.ts` | Inserts `professional_claim_id` from `era_claim_payments.professional_claim_id` |
| `lib/workqueue/era835ExceptionWorkqueueService.ts` | Same pattern as ERA mismatch service |
| `app/api/workqueue/items/route.ts` | Selects and exposes both `claim_id` and `professional_claim_id` in DTO; canonical column is first-class |
| `app/api/patients/[clientId]/workqueue/route.ts` | Selects and maps both columns; exposes `professionalClaimId` as top-level DTO field |
| `app/api/billing/claim-readiness/create-837p-batch/route.ts` | Writes `professional_claim_id` to `edi_batch_claims` |

### Should Remain Legacy Readonly — do not migrate yet

These files write `claim_id` because the source data (VCC payments,
payment import items) still carries FK constraints pointing to `claims`.

| File | Notes |
|---|---|
| `app/api/workqueue/sync/route.ts` (payment_posting_needed) | `payment_import_items.claim_id` FK → `claims`; must remain until FK is re-pointed |
| `app/api/workqueue/sync/route.ts` (vcc_processing) | `vcc_payments.claim_id` FK → `claims`; same constraint |

### Needs Migration to `professional_claim_id` — Phase 2–4 priority

These files create workqueue items using the legacy `claim_id` path even
though the claim source could (after Phase 2) be `professional_claims`.

| File | Routing Issue | Migration Phase |
|---|---|---|
| `app/workqueue/WorkqueueClient.tsx` | Action gate uses `claimId` alone (line 141); misses canonical-only items | Phase 2 |
| `app/api/workqueue/sync/route.ts` (no_response, denial_followup) | Reads `claims` for these work types, writes `claim_id` | Phase 3 |
| `lib/workflow/workflowFunctions.ts` | Creates workqueue items with `claim_id` from legacy `claims` (line 226) | Phase 4 |
| `lib/workflow/workflowActions.ts` | Writes `claim_id` in workqueue update (line 232) | Phase 4 |
| `app/api/lifecycle/run-full-flow/route.ts` | Full-flow test route uses `claim_id` from legacy `claims` | Phase 5 (after service layer) |

### Manual Review — routing decision required

| File | Issue |
|---|---|
| `app/workqueue/WorkqueueClient.tsx` (claim status submit, line 151) | Passes `claimId` (legacy) to claim status endpoint; should prefer `professionalClaimId` but endpoint may still expect legacy ID |
| `lib/workflow/workflowFunctions.ts` (line 204) | `createWorkqueueItemForClaim` uses `claim_id: claimId` where `claimId` may be a legacy or canonical ID — ambiguous at call site |

---

## Using `workqueueClaimRouting.ts`

```ts
import {
  getCanonicalClaimReference,
  resolveWorkqueueClaimTarget,
  hasProfessionalClaimReference,
  hasLegacyClaimReference,
  canonicalClaimColumns,
  legacyClaimColumns,
} from "@/lib/workqueue/workqueueClaimRouting";

// ── Inserting a canonical workqueue item ──────────────────────────────────────
const { error } = await supabase.from("workqueue_items").insert({
  organization_id: orgId,
  title: "Claim ready for submission",
  work_type: "clearinghouse_rejection",
  status: "open",
  priority: "high",
  source_object_type: "professional_claim",
  source_object_id: professionalClaim.id,
  client_id: professionalClaim.patient_id,
  ...canonicalClaimColumns(professionalClaim.id),
  created_at: now,
  updated_at: now,
});

// ── Resolving claim detail in a service ───────────────────────────────────────
const { table, claimId, isCanonical } = resolveWorkqueueClaimTarget(item);
if (table && claimId) {
  const { data: claim } = await supabase
    .from(table)
    .select("*")
    .eq("id", claimId)
    .single();
}

// ── Gating UI actions ─────────────────────────────────────────────────────────
if (hasProfessionalClaimReference(item)) {
  // render canonical claim detail link
}
if (hasLegacyClaimReference(item)) {
  // render legacy claim link with migration warning
}

// ── Getting the best available claim ID ──────────────────────────────────────
const claimId = getCanonicalClaimReference(item); // prefers professional_claim_id
```
