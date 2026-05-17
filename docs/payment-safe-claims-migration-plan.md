# Payment-Safe Claims Migration Plan

**Status:** Planning phase – do not implement until prerequisites met

**Objective:** Safely migrate payment-related claim references from legacy `claims` table to `professional_claims` without losing financial reconciliation capability.

## Remaining Claims References (13 total)

### Category 1: Payment Import & Reconciliation Flows (7 usages)

**Files:**

- `app/api/payments/import-835/route.ts` (2 usages)
- `app/api/payments/insurance/route.ts` (2 usages)
- `app/api/payments/post/route.ts` (1 usage)
- `app/api/payments/client/route.ts` (2 usages)

**Operations:**

- Lookup claims by ID for payment matching
- Update claim status + financial amounts after payment posting
- Reconciliation with 835 ERA responses
- Payer-to-claim matching logic

**Risk Level:** 🔴 **CRITICAL** – Financial data, reconciliation depends on exact field matching

---

### Category 2: Clearinghouse Integration Flows (5 usages)

**Files:**

- `lib/clearinghouse/ClearinghouseService.ts` (2 usages)
- `lib/clearinghouse/adapters/OfficeAllyJsonApiAdapter.ts` (1 usage)
- `app/api/clearinghouse/office-ally/era-835/route.ts` (2 usages)

**Operations:**

- Claim lookup for status inquiry creation
- Claim update with clearinghouse response metadata
- 277CA claim status update mapping
- Office Ally adapter integration

**Risk Level:** 🔴 **CRITICAL** – Clearinghouse communication depends on consistent claim ID mapping

---

### Category 3: ERA 835 Batch Parsing (1 usage)

**Files:**

- `supabase/functions/parse-835-batch/index.ts` (1 usage)

**Operations:**

- Match incoming 835 batch claims against existing claims
- Extract claim control number + line item mapping

**Risk Level:** 🔴 **CRITICAL** – Core payment reconciliation logic

---

## Prerequisites for Safe Migration

Before migrating any payment/clearinghouse/ERA flows, `professional_claims` must support:

### 1. **Claim Control Number Mapping** ✋ NOT READY

```text
Issue: Legacy claims have claim_number (CLM-xxx).
Professional claims also have claim_number, but:
  - Different generation logic?
  - Legacy claims in system won't auto-map?
  - Need explicit legacy_claim_number → professional_claim.claim_number mapping?

Required:
  - professional_claims.legacy_claim_number (nullable UUID FK to claims.id)
  OR
  - Deterministic claim_number generation so legacy + professional claims
    produce same identifier for 835 matching
```

### 2. **Payer Matching & Reconciliation** ✋ NOT READY

```text
Issue: 835 ERA responses reference claims by:
  - Payer claim ID (OA-CLAIM-xxx)
  - Patient name + DOB + account number
  - Service date ranges

Professional claims currently tracks:
  - total_charge (single value, no service date range)
  - patient_id (client_id)
  - encounter_id (not payer-facing)

Missing:
  - date_of_service_from / date_of_service_to (professionally relevant for matching)
  - Clear payer-facing claim identifier strategy
  - Insurance policy linkage for subscriber matching
```

### 3. **Financial Amounts Layer** ✋ NOT READY

```text
Issue: Legacy claims stores on claim row:
  - patient_responsibility_amount
  - payer_responsibility_amount
  - paid_at

Professional claims designed for service-line-level amounts:
  - All amounts on claim_service_lines
  - No claim-level patient/payer splits
  - No paid_at field

Problem: Payment posting updates claim financials.
  If we migrate payment workflows to professional_claims:
  - Where do we write patient_responsibility_amount post-posting?
  - Where do we write paid_at timestamp?
  - How do we reconcile claim total vs. service line sum?

Required:
  - Either add paid_at + responsibility amount fields to professional_claims
  - OR create separate era_claim_payments table that links to professional_claims
    (not legacy claims.id)
```

### 4. **Payment Import Item Linkage** ✋ NOT READY

```text
Issue: payment_import_items table currently uses:
  claim_id (FK to claims.id)

Professional claims migration needs:
  - payment_import_items.professional_claim_id (FK to professional_claims.id)
  - Still need claim_id for legacy payments in-flight?
  - Or dual path with coalesce(professional_claim_id, claim_id)?

Required:
  - Schema migration to add professional_claim_id to payment_import_items
  - Clear strategy for legacy claim references (support both? deprecate?)
```

### 5. **Claim Status Reconciliation Strategy** ✋ NOT READY

```text
Issue: Multiple status sources:
  - 837P submission status (clearinghouse ack)
  - 277CA inquiry response (payer status)
  - 835 payment posting (financial reconciliation)
  - Manual claim status updates

Professional claims.claim_status currently:
  - "draft" | "submitted" | "ready_for_validation" | "ready_for_batch" | ...
  - No clear "denied", "paid", "partial_paid" states equivalent to legacy

Legacy claims.claim_status:
  - "submitted" | "denied" | "rejected" | "paid" | ...

Required:
  - Unify claim_status enum across both tables OR
  - Clear mapping of legacy → professional status codes
  - claim_status_events table must work with professional_claims.id
```

### 6. **Legacy Claim ID Mapping** ✋ NOT READY

```text
Issue: In-flight payments may reference legacy claims.id

Solution options:
  1. Keep legacy claims table as read-only archive during transition
  2. Add professional_claims.legacy_claim_id (FK to claims.id)
  3. Migrate payment_import_items to dual-path lookups (try professional first, fallback to legacy)

Required:
  - Decision on legacy claim archive strategy
  - If using legacy_claim_id: migration to backfill professional_claims.legacy_claim_id
    from encounter_id join
```

---

## Migration Sequence (After Prerequisites Met)

### Phase 1: Payment Import Foundation

1. Add professional_claim_id to payment_import_items
2. Migrate payment_import_items to dual-path lookup
3. Backfill professional_claim_id where possible
4. Test with import-835 route

### Phase 2: Claim Status Reconciliation

1. Extend professional_claims with financial fields (or use era_claim_payments)
2. Migrate claim_status_events to professional_claims.id
3. Update clearinghouse status inquiry logic
4. Test with ClearinghouseService reads

### Phase 3: Payment Posting

1. Update payment posting routes to write professional_claims
2. Dual-path: write both legacy + professional during transition
3. Add legacy_claim_id mappings where needed
4. Test with payment posting workflows

### Phase 4: Clearinghouse Integration

1. Update OfficeAlly adapter to reference professional_claims claim_number
2. Migrate era-835 route claim lookups
3. Test full 835 batch parsing flow

### Phase 5: Archive & Cleanup

1. Mark legacy claims table as deprecated in code
2. Create read-only view for legacy queries
3. Plan archival schedule

---

## Completed Safe Migrations ✅

- **Lifecycle endpoint** (3 usages): Read existing, create, update status
- **Workqueue sync** (3 usages): Read for aging/denial workitems
- **EHR pipeline** (4 usages): Read existing, create, read for submit, update status

**Summary – Non-payment migrations:** 10 usages (pure creation/read/status, no financial data)

**Summary – Payment-blocked migrations:** 13 usages (all payment-related, all financial)

---

## Decision Point

**Current situation:**

- Non-payment claim workflows fully migrated to `professional_claims` ✅
- Payment/clearinghouse/ERA workflows still require legacy `claims` table
- Professional claims schema lacks financial reconciliation capability

**Next steps:**

1. Decide on professional_claims enhancement strategy (add fields vs. separate table)
2. Plan payment_import_items schema migration
3. Define claim_status reconciliation approach
4. Implement prerequisites Phase 1 before touching any payment code

**Recommendation:**

Do NOT begin payment/clearinghouse/ERA migrations until Prerequisites 1–6 are fully implemented and tested. Risk of silent payment reconciliation failures is too high.
