# THERASSISTANT EHR — Claim Detail Routing

**Status:** Active guidance · Non-destructive · Build-safe  
**Last updated:** 2026-05-15  
**Companion file:** [`lib/claims/claimDetailRouting.ts`](../lib/claims/claimDetailRouting.ts)  
**See also:** [`docs/claim-routing-normalization.md`](./claim-routing-normalization.md) · [`docs/workqueue-claim-routing.md`](./workqueue-claim-routing.md)

---

## Overview

Claim detail navigation in this application is split across two parallel paths
that mirror the underlying database tables. This document defines which route is
canonical, how to resolve ambiguous claim references, and which pages and
components require migration.

> **No routes are deleted. No tables are renamed. No schema is mutated.**
> This document + the routing helper file are the normalization layer.

---

## Route Inventory

| Route pattern | App page file | Status |
|---|---|---|
| `/billing/claim-readiness` | `app/billing/claim-readiness/page.tsx` | **Implemented — canonical claim workspace** |
| `/billing/837p-batches` | `app/billing/837p-batches/page.tsx` | Implemented — canonical EDI batch list |
| `/billing/claims/[id]` | _(no page file)_ | **Phantom — declared in RBAC, not built yet** |
| `/claims` | _(no page file)_ | Phantom — referenced by dashboard links |
| `/claims/[id]` | _(no page file)_ | Phantom — declared in RBAC, legacy compat route |
| `/patients/[clientId]/claims` | `app/patients/[clientId]/claims/page.tsx` | Implemented — patient claim history |

### Phantom routes

`/billing/claims/[id]` and `/claims/[id]` are registered in
`lib/rbac/protected-routes.ts` (lines 107, 119) but have no corresponding
`page.tsx` file. Any in-app link to these paths currently hits the Next.js 404.
Building the canonical detail page at `/billing/claims/[id]` is the top UI
priority in Phase 2 below.

---

## Canonical Claim Detail Route

The **canonical claim detail page** is `/billing/claims/[id]`, where `[id]` is
a `professional_claims.id`.

Until that page is built, the canonical workspace `/billing/claim-readiness`
serves as the fallback. All helpers in `claimDetailRouting.ts` already generate
`/billing/claims/[id]` hrefs so that once the page exists, call sites require
zero changes.

```
Canonical claim detail URL:  /billing/claims/{professional_claims.id}
Canonical claim workspace:   /billing/claim-readiness
Backed by table:             professional_claims
```

The legacy route `/claims/{claims.id}` is preserved for backward compatibility
only. New UI code must never link to it for claims that exist in
`professional_claims`.

---

## Preferred Claim Lookup Order

When resolving a claim record for display or action, use this precedence:

```
1. professional_claims.id   →  query professional_claims
2. claims.id                →  query claims  (legacy fallback)
3. null                     →  no claim available — link to workspace
```

Use `resolveClaimDetailTarget()` from `lib/claims/claimDetailRouting.ts` to
perform this resolution.

---

## Workqueue-Driven Navigation Behavior

When a workqueue item carries a claim reference, navigation should follow
the workqueue claim routing layer (`lib/workqueue/workqueueClaimRouting.ts`)
first, then translate the resolved claim ID into a detail href using
`buildClaimDetailHref()`.

```ts
import { resolveWorkqueueClaimTarget } from "@/lib/workqueue/workqueueClaimRouting";
import { buildClaimDetailHref } from "@/lib/claims/claimDetailRouting";

const { claimId, isCanonical } = resolveWorkqueueClaimTarget(item);
const href = buildClaimDetailHref({
  professionalClaimId: isCanonical ? claimId : null,
  legacyClaimId:       isCanonical ? null    : claimId,
  organizationId,
});
// → "/billing/claims/{claimId}?organizationId=..." (canonical)
// → "/claims/{claimId}?organizationId=..."         (legacy fallback)
```

Current state: `WorkqueueClient.tsx` links to `/billing/claim-readiness?organizationId=...`
when `professionalClaimId` is present (line 266). This is correct behavior
today but should be updated to `buildClaimDetailHref()` so it auto-upgrades
to the per-claim route once the page is built.

---

## Handling for Legacy Claims

Legacy claims (rows in the `claims` table) may appear in:

- Payment posting allocations
- VCC payment records
- Documents
- Lifecycle test routes
- Workflow engine items

For these items, use `getLegacyClaimDetailRoute(claimId, orgId)` to generate
links. The `/claims/[id]` page should be implemented as a read-only
compatibility view that displays legacy claim data and shows a migration banner
when a matching `professional_claims` row exists.

Do **not** implement write operations (re-submit, status update, ERA apply) on
the legacy `/claims/[id]` page. All mutating actions must go through canonical
routes backed by `professional_claims`.

---

## Compatibility Strategy

During the migration window:

1. **`buildClaimDetailHref(ref)`** automatically picks the right route based on
   which ID is available. Call sites need no conditional logic.
2. **`isCanonicalClaimDetail(ref)`** guards canonical-only actions (EDI
   re-submit, claim status inquiry via 270/271) so they are not offered on
   legacy claim detail pages.
3. The `/api/claims/[claimId]/status-history` route currently passes its
   `claimId` param to `ClearinghouseService.getClaimStatusHistory()`, which
   queries `claim_status_inquiries`, `edi_transactions`, and
   `clearinghouse_response_events` using `claim_id` (a legacy FK column).
   Until `professional_claims.id` is also indexed in those tables, callers
   must be aware that this endpoint resolves only legacy-path history.

---

## Migration Strategy

### Phase 1 — Routing helpers (complete)
- `lib/claims/claimDetailRouting.ts` created.
- No runtime behavior changed.

### Phase 2 — Build `/billing/claims/[id]` page
- Create `app/billing/claims/[id]/page.tsx`.
- Reads from `professional_claims` and `professional_claim_service_lines`.
- Shows: claim header, service lines, status events, ERA payments, workqueue items.
- Gated on `PERMISSIONS.VIEW_BILLING | VIEW_CLAIMS` (already in protected-routes).
- Once live, all `buildClaimDetailHref()` calls automatically deep-link here.

### Phase 3 — Update WorkqueueClient navigation
- `app/workqueue/WorkqueueClient.tsx` line 266: replace hardcoded
  `/billing/claim-readiness?organizationId=...` with
  `buildClaimDetailHref({ professionalClaimId: selected.professionalClaimId, organizationId })`.

### Phase 4 — Update dashboard / homeData links
- `lib/dashboard/homeData.ts` lines 77, 135, 141 link to `/claims` (phantom).
  After Phase 2, update to `/billing/claim-readiness` or a filtered canonical
  claims list route.

### Phase 5 — Migrate create-from-encounter to canonical table
- `app/api/claims/create-from-encounter/route.ts` inserts into `claims` (legacy).
  Migrate to insert into `professional_claims` so new claims have canonical IDs.
  This is the prerequisite for the clearinghouse status history ambiguity fix.

### Phase 6 — Fix status history ambiguity
- `app/api/claims/[claimId]/status-history/route.ts` receives a `claimId` that
  may be from either `professional_claims` or `claims`.
  After Phase 5, all new claims have `professional_claims.id` as their ID.
  Add dual-lookup logic: try `claim_status_events` (canonical) first, then fall
  back to `claim_status_inquiries` (legacy).

### Phase 7 — Build `/claims/[id]` legacy compat page
- Implement a read-only page at `app/claims/[id]/page.tsx`.
- Shows legacy claim data with a banner: "This is a legacy claim record.
  [View canonical record →]" when a matching `professional_claims` row exists.

---

## Pages and Components Requiring Manual Review

| File | Issue |
|---|---|
| `app/workqueue/WorkqueueClient.tsx` (line 266) | Links to `/billing/claim-readiness` for canonical claims instead of `/billing/claims/[id]`; update to `buildClaimDetailHref()` in Phase 3 |
| `app/billing/claim-readiness/ClaimReadinessClient.tsx` (`checkClaimStatus`, line 93) | Passes `item.claim.id` (from `professional_claims`) to clearinghouse status endpoint which internally reads `claims`; table ID mismatch once migration is complete |
| `lib/dashboard/homeData.ts` (lines 77, 135, 141) | Dashboard links to `/claims` (no page); update target in Phase 4 |
| `lib/demo/operationalDemoData.ts` (lines 54, 66) | Demo hrefs `/claims/demo-claim-001` pointing to phantom legacy route; acceptable for demo data but note for future cleanup |
| `lib/clearinghouse/ClearinghouseService.ts` (`runClaimStatus`, line 309) | Reads `claims` by ID — must be updated to try `professional_claims` first after Phase 5 |
| `app/api/claims/[claimId]/status-history/route.ts` | Ambiguous `claimId` param — could be from either table; add resolution logic in Phase 6 |

---

## Codebase Audit Results (2026-05-15)

### Already Canonical — no action needed

These files read from `professional_claims` for claim detail or list display.

| File | Notes |
|---|---|
| `app/billing/claim-readiness/page.tsx` + `ClaimReadinessClient.tsx` | Canonical claim workspace; reads `professional_claims` via API |
| `app/api/billing/claim-readiness/route.ts` | Queries `professional_claims` for charge/claim readiness list |
| `app/api/billing/claim-readiness/create-837p-batch/route.ts` | Reads `professional_claims` for batch creation |
| `app/api/billing/837p-batches/route.ts` | Reads `edi_batch_claims` → `professional_claims` |
| `app/billing/837p-batches/Batches837PClient.tsx` | Canonical EDI batch list; links to `/billing/claim-readiness` |
| `app/patients/[clientId]/claims/page.tsx` | Patient claim history reads `professional_claims` via API |
| `app/api/patients/[clientId]/claims/route.ts` | Queries `professional_claims` |
| `lib/claims/claimReadinessService.ts` | Canonical claim creation and readiness service |
| `app/api/claims/readiness/route.ts` | Canonical readiness wrapper |
| `app/api/claims/837p/batch/route.ts` | Canonical EDI batch |
| `app/api/claims/837p/submit/route.ts` | Canonical EDI submission |
| `app/api/claims/acknowledgements/277ca/route.ts` | Canonical 277CA handler |
| `app/api/claims/acknowledgements/999/route.ts` | Canonical 999 handler |

### Should Remain Legacy Readonly — do not migrate yet

| File | Notes |
|---|---|
| `lib/clearinghouse/ClearinghouseService.ts` (`getClaimStatusHistory`) | Queries `claim_status_inquiries`, `edi_transactions`, `clearinghouse_response_events` via legacy `claim_id` FK; preserve until those tables add `professional_claim_id` columns |
| `lib/workflow/workflowFunctions.ts` | Reads/writes `claims` table; must remain until Phase 4–5 migration |
| `lib/workflow/workflowActions.ts` | Writes claim status to `claims` table; same constraint |
| `lib/ehr/pipeline.ts` | Creates `claims` and `claim_service_lines` from encounter; preserve until Phase 5 |

### Needs Migration — Phase 2–6 priority

| File | Routing Issue | Phase |
|---|---|---|
| `app/workqueue/WorkqueueClient.tsx` (line 266) | Hardcoded `/billing/claim-readiness` link; replace with `buildClaimDetailHref()` | 3 |
| `lib/dashboard/homeData.ts` (lines 77, 135, 141) | Links to `/claims` (phantom route) | 4 |
| `app/api/claims/create-from-encounter/route.ts` | Inserts into `claims` (legacy) instead of `professional_claims` | 5 |
| `lib/clearinghouse/ClearinghouseService.ts` (`runClaimStatus`) | Reads `claims` by ID — needs canonical lookup after Phase 5 | 6 |
| `app/api/claims/[claimId]/status-history/route.ts` | Ambiguous ID param; needs dual-lookup after Phase 5 | 6 |

### Manual Review — routing decision required

| File | Issue |
|---|---|
| `app/billing/claim-readiness/ClaimReadinessClient.tsx` (`checkClaimStatus`) | Sends `professional_claims.id` to clearinghouse status endpoint which internally reads `claims` (FK mismatch); will break silently after Phase 5 migration unless clearinghouse service is updated simultaneously |
| `lib/demo/operationalDemoData.ts` | Demo hrefs point to `/claims/demo-claim-001`; no real claim; acceptable but note phantom route dependency |

---

## Using `claimDetailRouting.ts`

```ts
import {
  resolveClaimDetailTarget,
  isCanonicalClaimDetail,
  getCanonicalClaimDetailRoute,
  getLegacyClaimDetailRoute,
  buildClaimDetailHref,
} from "@/lib/claims/claimDetailRouting";

// ── Build a claim link in a UI component ──────────────────────────────────────
const href = buildClaimDetailHref({
  professionalClaimId: item.professionalClaimId,
  legacyClaimId:       item.claimId,
  organizationId,
});
// → "/billing/claims/{id}?organizationId=..."   (canonical, preferred)
// → "/claims/{id}?organizationId=..."           (legacy fallback)
// → "/billing/claim-readiness?organizationId=..." (no ID available)

// ── Load claim detail in an API route ─────────────────────────────────────────
const { table, claimId } = resolveClaimDetailTarget({
  professionalClaimId: params.professionalClaimId,
  legacyClaimId:       params.legacyClaimId,
});
if (table && claimId) {
  const { data } = await supabase.from(table).select("*").eq("id", claimId).single();
}

// ── Gate canonical-only actions ───────────────────────────────────────────────
if (isCanonicalClaimDetail({ professionalClaimId })) {
  // safe to offer "Re-submit 837P" / "Apply ERA adjustment"
}

// ── Generate explicit route strings ───────────────────────────────────────────
getCanonicalClaimDetailRoute("abc-123", "org-456");
// → "/billing/claims/abc-123?organizationId=org-456"

getLegacyClaimDetailRoute("old-abc-123", "org-456");
// → "/claims/old-abc-123?organizationId=org-456"
```
