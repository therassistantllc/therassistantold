# TherAssistant ↔ OpenMRS Patient Roster Replacement Matrix

## Current TherAssistant API: GET /api/clients

**File**: `app/api/clients/route.ts`
**Data Source**: Supabase `clients` table + `patient_invoices` join
**Output**: 6 core fields + 4 metrics

---

## OpenMRS Equivalent: GET /ws/rest/v1/patient

**REST Endpoint**: `/openmrs/ws/rest/v1/patient?v=full&limit=250`
**Core Resource**: Patient → Person (demographics)
**Related Resources**: PatientIdentifier, PersonAttribute

---

## Field-by-Field Replacement Matrix

| TherAssistant Field | Current Source | OpenMRS Equivalent | Replace? | Migration Complexity | Risk Level | Notes |
|---|---|---|---|---|---|---|
| `id` (UUID) | `clients.id` | `patient.uuid` | INTEGRATE | Low | ⚠️ Medium | Store both UUIDs; use openmrs_patient_uuid as external ref |
| `name` | `clients.first_name + last_name` | `patient.person.names[0]` | INTEGRATE | Low | Low | OpenMRS supports multiple names; use preferred |
| `preferredName` | `clients.preferred_name` | `patient.person.attributes[]` | KEEP CUSTOM | — | — | Not standard in OpenMRS; keep in TherAssistant |
| `email` | `clients.email` | `patient.person.attributes[]` | INTEGRATE | Low | Low | Stored as PersonAttribute type, searchable |
| `phone` | `clients.phone` | `patient.person.attributes[]` | INTEGRATE | Low | Low | Stored as PersonAttribute type, searchable |
| `status` | `clients.deceased_at` | `patient.person.dead` | INTEGRATE | Low | Low | Boolean → "active"/"deceased" |
| `intakeStatus` | (not in current clients table) | (N/A) | KEEP CUSTOM | — | — | TherAssistant-specific workflow state |
| `openBalance` | JOIN `patient_invoices` | (N/A) | KEEP CUSTOM | — | — | Billing is TherAssistant-only; no OpenMRS equivalent |
| `updatedAt` | `clients.updated_at` | `patient.auditInfo.dateChanged` | INTEGRATE | Medium | Medium | OpenMRS tracks separately; could drift if both systems update |

---

## Search/Filter Capability Comparison

| Feature | TherAssistant | OpenMRS | Compatible? |
|---------|---|---|---|
| Search by name | `first_name` + `last_name` | `name` attribute (Person) | ✅ YES |
| Search by email | `email` exact match | `email` PersonAttribute | ✅ YES |
| Search by phone | `phone` exact match | `phone` PersonAttribute | ✅ YES |
| Filter by archived | `archived_at IS NULL` | `patient.voided` | ✅ YES (inverted) |
| Filter by org | `organization_id` | (N/A) | ⚠️ CUSTOM |
| Limit results | SQL `LIMIT 250` | OpenMRS API limit param | ✅ YES |
| Sort by name | SQL `ORDER BY last_name` | OpenMRS sort param | ✅ YES |

---

## Metrics Calculation Comparison

| Metric | TherAssistant | OpenMRS | Source |
|--------|---|---|---|
| `total` | Count filtered clients | Count API results | ✅ API result |
| `active` | `status = "active"` | `person.dead = false` | ✅ API field |
| `intakeIncomplete` | NULL intakeStatus | (N/A) | ❌ CUSTOM ONLY |
| `withBalance` | `openBalance > 0` | (N/A) | ❌ CUSTOM ONLY |

---

## Integration Strategy: Hybrid Adapter Layer

```
Frontend (/clients, /clinician/agenda, etc.)
         ↓
    /api/clients (SAME RESPONSE FORMAT)
         ↓
    Adapter Layer
    ├─ Search: OpenMRS API OR Supabase?
    ├─ Patient data: OpenMRS if available, else Supabase
    ├─ Billing: Always Supabase
    ├─ Workflow state: Always Supabase
    └─ Map OpenMRS → TherAssistant response
         ↓
    Return unified client roster
```

---

## Recommended Implementation Approach

### Phase 1: Add OpenMRS Data Source (Non-Breaking)
1. Create `lib/openmrs-adapter/patient-search.ts` 
   - Function: `searchOpenMRSPatients(query, limit)` → OpenMRS REST API
   - Maps OpenMRS Patient → TherAssistant client format
   - Handles missing fields gracefully

2. Modify `app/api/clients/route.ts`
   - Add conditional: `if (useOpenMrsPatients) { ... }`
   - Combine Supabase + OpenMRS results
   - Keep all existing TherAssistant fields
   - No frontend changes needed

3. Env flag: `USE_OPENMRS_PATIENTS=false` (default)
   - Gradual rollout: can flip per organization
   - Easy rollback if issues

### Phase 2: Sync Patient Data
1. When OpenMRS patient found
   - Check if TherAssistant client exists (by `externalClientRef`)
   - If not: import via adapter layer (lib/openmrs-adapter/transform.ts)
   - If yes: keep TherAssistant version as source of truth

2. Mapping strategy
   - OpenMRS uuid → store as `external_client_ref`
   - OpenMRS last_update → check against `updated_at`
   - If OpenMRS is fresher: can choose to update or ignore

### Phase 3: Replace Only When Ready
- UI doesn't change (same API response)
- Billing logic untouched
- Workflow state untouched
- Can run dual-source indefinitely

---

## Risk Analysis

### Low Risk (Safe to implement immediately)
- ✅ Reading from OpenMRS API (read-only)
- ✅ Mapping to TherAssistant response format
- ✅ Keeping Supabase as backup/source of truth
- ✅ Feature-flag approach

### Medium Risk (Needs careful handling)
- ⚠️ Name/email/phone attribute mappings (different per OpenMRS config)
- ⚠️ Deceased status (boolean vs complex state)
- ⚠️ Search performance on large patient bases

### High Risk (Don't touch yet)
- ❌ Writing back to OpenMRS
- ❌ Deleting OpenMRS records
- ❌ Merging duplicate patients
- ❌ Two-way sync without clear ownership

---

## Next Steps

1. **Implement Patient Search Adapter**
   - `lib/openmrs-adapter/patient-search.ts`
   - Test against OpenMRS demo instance
   - Document attribute mappings

2. **Test Hybrid Mode**
   - Toggle `USE_OPENMRS_PATIENTS`
   - Verify response format matches
   - Load test with real OpenMRS data

3. **Repeat for Other Core Endpoints**
   - Appointments (esm-appointments-app REST API)
   - Encounters (esm-encounters-app REST API)
   - Documents/Attachments (esm-attachments-app REST API)

---

## Decision: INTEGRATE (Not Replace)

**Verdict**: Don't replace Supabase with OpenMRS yet.  
**Instead**: Add OpenMRS as *optional secondary source* behind adapter layer.

**Rationale**:
1. Billing logic is TherAssistant-unique
2. Workflow state (intake, encounter tracking) is TherAssistant-unique
3. Can run both systems in parallel
4. No frontend changes needed (same API response)
5. Easy rollback (just flip env flag)
6. Gradual migration path
