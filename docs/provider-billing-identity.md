# THERASSISTANT EHR — Provider Billing Identity Architecture

**Status:** Active guidance · Non-destructive · Build-safe  
**Last updated:** 2026-05-15  
**Companion file:** [`lib/providers/providerBillingIdentity.ts`](../lib/providers/providerBillingIdentity.ts)  
**See also:** [`docs/claim-routing-normalization.md`](./claim-routing-normalization.md) · [`docs/claim-detail-routing.md`](./claim-detail-routing.md)

---

## Overview

The application maintains three provider-related tables that serve distinct roles
in the claim lifecycle. This document defines which table owns each aspect of
provider identity and how that identity flows into 837P claim submission.

> **No tables are deleted. No tables are renamed. No schema is mutated.**
> This document + `providerBillingIdentity.ts` are the normalization layer.

---

## Table Inventory

| Table | Purpose | Claim Role |
|---|---|---|
| `providers` | Operational roster — who works here | Rendering provider NPI + Medicaid fallback |
| `provider_profiles` | Rendering/licensing identity — license #, specialty | Reference only; not read during claim generation today |
| `provider_credentialing_profiles` | **Canonical billing identity** — NPI, tax ID, practice address, taxonomy | Source of truth for all billing provider fields in `claim_parties_snapshot` |
| `provider_payer_enrollments` | Enrollment status with specific payers | Not yet read at claim time; Phase 3 migration target |
| `payer_profiles` | Payer directory — Office Ally payer ID | Read during claim creation for `payer_name` / `payer_id` |
| `claim_parties_snapshot` | Frozen-at-submission party identity | Output of resolution; never read back as a resolution source |

---

## Canonical Provider Operational Profile

**Table:** `providers`

The `providers` table is the operational roster — it tracks who is working at
the practice, their credentials display string, and their basic identifiers.

**Fields used at runtime:**

| Field | Purpose |
|---|---|
| `id` | Primary key; passed as `providerId` / `renderingProviderId` |
| `npi` | NPI for cross-referencing credentialing profile |
| `first_name`, `last_name` | Rendering provider name segments for NM1*82 |
| `taxonomy_code` | Fallback taxonomy when credentialing profile is missing |
| `medicaid_id` | Legacy fallback Medicaid ID (prefer credentialing profile) |
| `can_bill_independently` | Gate for billing authorization; checked before claim creation |

**Fields NOT used in claim generation:**

`email`, `phone`, `display_name`, `user_id`, `credential` (display only),
`provider_type` (roster classification).

---

## Canonical Billing Identity Source

**Table:** `provider_credentialing_profiles`

All billing provider fields in `claim_parties_snapshot` (and by extension, all
837P `NM1*85`, `N3`, `N4`, `REF`, and `PRV` segments) must be sourced from
`provider_credentialing_profiles`.

**Critical fields for 837P generation:**

| `provider_credentialing_profiles` column | 837P segment | Requirement |
|---|---|---|
| `practice_name` | NM1*85 (billing name) | Required |
| `group_npi` OR `individual_npi` | NM1*85 (XX qualifier) | Required; 10 digits |
| `practice_tax_id` | REF*EI or REF*SY | Required |
| `practice_address` *(free text)* | N3 + N4 | Parsed via regex — **fragile; see Known Issues** |
| `taxonomy_code` | PRV*BI | Optional but strongly recommended |
| `individual_npi` | NM1*82 (rendering) | Required when rendering ≠ billing |
| `individual_medicaid_id` | REF*1D (Medicaid claims) | Required for Medicaid payers |
| `group_medicaid_id` | REF*1D fallback | Used when individual ID absent |

**Lookup key:** `(organization_id, individual_npi)` with `is_active = true` and
`archived_at IS NULL`.

**Fallback:** If NPI is unknown, resolver selects the first active profile
ordered by `provider_name ASC`. This is a last-resort fallback — resolve
by NPI whenever possible.

---

## Canonical Credentialing Source

**Table:** `provider_credentialing_profiles`

The same table owns credentialing data:

| Field | Credentialing Purpose |
|---|---|
| `primary_license_number`, `primary_license_effective_date` | Primary state license |
| `secondary_license_number`, `secondary_license_effective_date` | Secondary state license |
| `caqh_id` | CAQH credentialing ID |
| `medicare_ptan` | Medicare PTAN |
| `payer_effective_date`, `payer_revalidation_date` | Enrollment lifecycle dates |
| `ssn`, `date_of_birth` | Credentialing application fields |

`provider_profiles` holds rendering/licensing data (board certifications,
malpractice insurance) but is **not yet read during claim generation**. It is
the Phase 2 migration target for rendering provider identity enrichment.

---

## Payer Enrollment Ownership

**Table:** `provider_payer_enrollments`

Tracks whether a provider is enrolled with each payer. Fields:

| Field | Purpose |
|---|---|
| `provider_profile_id` | FK → `provider_profiles` (rendering identity) |
| `credentialing_profile_id` | FK → `provider_credentialing_profiles` |
| `payer_profile_id` | FK → `payer_profiles` |
| `enrollment_status` | Current status (pending, active, terminated) |
| `effective_date`, `expiration_date` | Enrollment window |
| `provider_payer_id` | Payer-assigned provider identifier |

**Current gap:** `resolveProviderCredentialingProfile()` does NOT query
`provider_payer_enrollments`. Claims can be created for payers with expired or
pending enrollment. Phase 3 adds this gate.

---

## Organization Billing Ownership

Organization-level billing fields are stored implicitly across:

1. **`provider_credentialing_profiles`**: `practice_name`, `practice_address`,
   `practice_tax_id`, `group_npi` — these are the organization's billing identity
   as presented to payers.

2. **`claim_parties_snapshot`**: `billing_provider_*` columns hold the frozen
   organization billing identity at submission time.

There is no dedicated `organizations_billing` table. If organization billing
fields change after claims are submitted, the snapshot preserves the correct
historical identity. New claims will pick up updated fields from the next
credentialing profile resolution.

---

## 837P Rendering Provider Mapping

The 837P `NM1*82` loop (Rendering Provider, 2310B) is written when
`rendering_same_as_billing = false` in `claim_parties_snapshot`.

**Resolution flow:**

```
1. Encounter/appointment → rendering provider ID or NPI
2. resolveRenderingProviderIdentity({ organizationId, renderingProviderId })
   → look up providers.npi
   → cross-reference provider_credentialing_profiles for taxonomy
3. Compare rendering NPI to billing NPI
4. If different → rendering_same_as_billing = false → write NM1*82
5. Write rendering_provider_npi to professional_claim_service_lines per line
```

**837P segment mapping:**

| `claim_parties_snapshot` column | 837P |
|---|---|
| `rendering_provider_entity_type` | NM1*82 qualifier (98=individual) |
| `rendering_provider_first_name` | NM1*82 first name |
| `rendering_provider_last_name_or_org` | NM1*82 last name |
| `rendering_provider_npi` | NM1*82 XX qualifier |
| `rendering_provider_taxonomy` | PRV*PE segment |

---

## 837P Billing Provider Mapping

The 837P `NM1*85` loop (Billing Provider, 2010AA) is always required.

**Resolution flow:**

```
1. resolveBillingProviderIdentity({ organizationId })
   → delegates to resolveProviderCredentialingProfile()
   → queries provider_credentialing_profiles by NPI (or first active)
   → billingProviderFromProfile() parses practice_address (fragile)
2. hasValidClaimIdentity(billing.billingProvider) → pre-flight guard
3. Write to claim_parties_snapshot.billing_provider_*
```

**837P segment mapping:**

| `claim_parties_snapshot` column | 837P |
|---|---|
| `billing_provider_entity_type` | NM1*85 entity type code |
| `billing_provider_name` | NM1*85 last name / org name |
| `billing_provider_first_name` | NM1*85 first name (individual only) |
| `billing_provider_npi` | NM1*85 XX qualifier |
| `billing_provider_tax_id` + `billing_provider_tax_id_type` | REF*EI (EIN) or REF*SY (SSN) |
| `billing_provider_address1` | N3 |
| `billing_provider_city`, `_state`, `_zip` | N4 |
| `billing_provider_taxonomy` | PRV*BI |

---

## Taxonomy Strategy

**Canonical source:** `provider_credentialing_profiles.taxonomy_code`

**Lookup order (via `resolveProviderTaxonomy()`):**

1. `provider_credentialing_profiles.taxonomy_code` by individual NPI
2. `providers.taxonomy_code` by provider ID
3. `providers.taxonomy_code` by NPI

The PRV segment in 837P is optional per X12 spec but recommended by most
payers. If `resolveProviderTaxonomy()` returns `null`, omit the PRV segment
rather than submitting a blank or placeholder value.

Taxonomy codes must be valid NUCC codes (see
[nucc.org](https://www.nucc.org/index.php/code-sets-mainmenu-41/provider-taxonomy-mainmenu-40)).
The most common codes for behavioral health:

| Specialty | Code |
|---|---|
| Licensed Professional Counselor | 101YM0800X |
| Licensed Clinical Social Worker | 1041C0700X |
| Psychologist | 103T00000X |
| Marriage and Family Therapist | 106H00000X |
| Psychiatric NP | 364SP0200X |

---

## Medicaid Enrollment Strategy

**Canonical source:** `provider_credentialing_profiles`

| Field | Use |
|---|---|
| `individual_medicaid_id` | REF*1D on individual Medicaid claims |
| `group_medicaid_id` | REF*1D fallback when individual ID absent |

**Fallback:** `providers.medicaid_id` (single field, legacy).

Use `resolveProviderMedicaidIdentity()` to always get the preferred ID:

```ts
const { preferredMedicaidId } = await resolveProviderMedicaidIdentity({
  organizationId,
  npi: renderingProviderNpi,
});
// Use in REF*1D segment for Medicaid payer claims
```

When `payer_profiles.payer_type = "medicaid"`, the claim builder should call
this helper and include the REF*1D segment. When Medicaid ID is absent, flag
the claim in `professional_claims.validation_errors` rather than submitting
without it — Medicaid payers reject claims missing provider IDs.

---

## Migration Strategy

### Phase 1 — Routing helpers (complete)
- `lib/providers/providerBillingIdentity.ts` created.
- All 5 helpers available. No runtime behavior changed.

### Phase 2 — Populate structured address columns
- **Problem:** `provider_credentialing_profiles.practice_address` is a free-text
  field. `billingProviderFromProfile()` parses it with regex — fragile.
- **Action:** Add columns `practice_city`, `practice_state`, `practice_zip` to
  `provider_credentialing_profiles`. Update the credentialing settings UI to
  collect them. Update `billingProviderFromProfile()` to read structured columns
  when present, falling back to regex for legacy rows.
- **Priority:** High — address parsing failures silently produce invalid claims.

### Phase 3 — Payer enrollment gate at claim creation
- **Problem:** No check of `provider_payer_enrollments` before creating claims.
- **Action:** In `createProfessionalClaimDraft()`, after resolving billing
  provider, query `provider_payer_enrollments` for the active enrollment with the
  target payer. If `enrollment_status != "active"` or enrollment is expired, add
  a `validation_error` to the claim. Do not block creation — warn.
- **Priority:** Medium — prevents submission-time rejections.

### Phase 4 — Enrich rendering provider from `provider_profiles`
- **Problem:** `provider_profiles` holds specialty, license, board certifications
  but is not read during claim generation.
- **Action:** In `resolveRenderingProviderIdentity()`, add a lookup to
  `provider_profiles` for specialty override when credentialing profile is absent.
- **Priority:** Low — taxonomy is already resolved; this enriches edge cases.

### Phase 5 — Add FK provider reference to `professional_claims`
- **Problem:** `professional_claims` has no FK to any provider table. Identity
  is entirely in `claim_parties_snapshot`.
- **Action:** Add `professional_claims.credentialing_profile_id` (nullable FK to
  `provider_credentialing_profiles`). Populate at claim creation time. Enables
  audit trail: "which provider profile version was this claim based on?"
- **Priority:** Low — audit/compliance value; not blocking for EDI.

### Phase 6 — Normalize `rendering_provider_npi` in service lines
- **Problem:** `professional_claim_service_lines.rendering_provider_npi` is a
  string, not a FK. Cannot join back to provider tables.
- **Action:** Add `rendering_credentialing_profile_id` column to service lines.
- **Priority:** Low — required for multi-provider encounter billing.

---

## Fields That Should Become Read-Only

After data is frozen into `claim_parties_snapshot`, the following fields on the
source records must be treated as **append-only / correction-only**:

| Table | Fields | Reason |
|---|---|---|
| `provider_credentialing_profiles` | `individual_npi`, `group_npi` | NPI changes require new credentialing profile, not edits |
| `provider_credentialing_profiles` | `practice_tax_id` | Tax ID changes trigger payer revalidation |
| `claim_parties_snapshot` | All columns | Frozen audit record; never update after 837P is generated |
| `professional_claim_service_lines` | `rendering_provider_npi` | Frozen at claim creation |

UI should enforce these as read-only fields once a claim using the profile has
been submitted. Corrections must create a new row (replacement claim workflow).

---

## Fields Requiring Manual Review

| Location | Field | Issue |
|---|---|---|
| `provider_credentialing_profiles.practice_address` | Free text | Parsed with regex; any non-standard format breaks city/state/zip extraction. **Phase 2 fix target.** |
| `providers.medicaid_id` | Single ID | Cannot distinguish individual vs. group. Use credentialing profile instead. |
| `provider_payer_enrollments` (all rows) | `enrollment_status` | Not validated at claim time; stale status may cause payer rejections. |
| `provider_credentialing_profiles.ssn` | SSN | Sensitive PII stored in plain text. Verify column encryption in Supabase RLS policies before production use. |
| `app/api/eligibility/check/route.ts` (line 214) | Mock NM1*1P | Hard-coded `1234567890` placeholder NPI in eligibility 837I request. Must be replaced with actual resolved provider NPI before going live. |
| `providerCredentialingResolverService.ts` — fallback (line 98) | First active profile fallback | When no NPI match, resolver silently picks first alphabetical profile. This may return the wrong provider for multi-clinician practices. |

---

## Codebase Audit Results (2026-05-15)

### Already canonical — no action needed

| File | Provider table(s) used | Notes |
|---|---|---|
| `lib/providers/providerCredentialingResolverService.ts` | `providers`, `provider_credentialing_profiles` | Canonical resolver; source of truth for billing provider assembly |
| `lib/claims/claimReadinessService.ts` | `claim_parties_snapshot` | Validates snapshot fields; correct pattern |
| `lib/edi/officeAlly837p/generate837p.ts` | `claim_parties_snapshot` | Reads snapshot only; correct pattern |
| `lib/edi/officeAlly837p/validate837p.ts` | `claim_parties_snapshot` | Validates snapshot fields; correct pattern |
| `lib/claims/edi837pBatchService.ts` | `claim_parties_snapshot` | Reads snapshot for batch generation |
| `app/api/providers/credentialing/route.ts` | `provider_credentialing_profiles` | CRUD for credentialing data |
| `app/settings/providers/ProvidersSettingsClient.tsx` | `provider_credentialing_profiles` | UI reads/writes correct table |

### Needs migration — Phase 2+ priority

| File | Issue | Phase |
|---|---|---|
| `lib/providers/providerCredentialingResolverService.ts` (`billingProviderFromProfile`) | Regex parsing of free-text `practice_address` — fragile | 2 |
| `lib/claims/claimReadinessService.ts` (`createProfessionalClaimDraft`) | Accepts `billingProvider` input without payer enrollment check | 3 |
| `lib/claims/chargeCaptureClaimBridgeService.ts` | Delegates to resolver; inherits address parsing fragility | 2 (via resolver fix) |

### Manual review required

| File | Issue |
|---|---|
| `app/api/eligibility/check/route.ts` (line ~214) | Hard-coded provider NPI `1234567890` in mock 837I; replace with resolved identity before production |
| `app/api/eligibility/prepare/route.ts` | Accepts `provider_npi` from caller with no validation or DB lookup |
| `lib/workflow/workflowFunctions.ts` | Creates workqueue items with `claim_id` (legacy table); does not use provider identity from credentialing profiles |

### Not used in claim generation — preserve as-is

| File/Table | Notes |
|---|---|
| `provider_profiles` table | Rendering/licensing identity; currently not read during claim generation. Preserve for future Phase 4 enrichment. |
| `provider_payer_enrollments` table | Enrollment status tracking; not queried at claim time. Phase 3 target. |

---

## Using `providerBillingIdentity.ts`

```ts
import {
  resolveRenderingProviderIdentity,
  resolveBillingProviderIdentity,
  resolveProviderTaxonomy,
  resolveProviderMedicaidIdentity,
  hasValidClaimIdentity,
} from "@/lib/providers/providerBillingIdentity";

// ── Build billing provider for claim snapshot ─────────────────────────────────
const billing = await resolveBillingProviderIdentity({ organizationId });
if (!billing.ok || !hasValidClaimIdentity(billing.billingProvider)) {
  return { error: "Billing provider identity incomplete", details: billing.errors };
}

// ── Resolve rendering provider for an encounter ───────────────────────────────
const rendering = await resolveRenderingProviderIdentity({
  organizationId,
  renderingProviderId: encounter.providerId,
});
const sameAsBilling = rendering.npi === billing.billingProvider?.npi;

// ── Look up taxonomy for PRV segment ─────────────────────────────────────────
const { taxonomyCode } = await resolveProviderTaxonomy({
  organizationId,
  npi: rendering.npi ?? undefined,
});

// ── Medicaid claim — get provider Medicaid ID ─────────────────────────────────
const { preferredMedicaidId } = await resolveProviderMedicaidIdentity({
  organizationId,
  npi: rendering.npi ?? undefined,
});

// ── Pre-flight guard before writing snapshot ──────────────────────────────────
if (!hasValidClaimIdentity(billing.billingProvider)) {
  // Add to professional_claims.validation_errors instead of throwing
}
```
