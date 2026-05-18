# OpenMRS Integration Roadmap: Efficient Hybrid Approach

## Strategy: Compare → Matrix → Implement → Hybrid

Instead of broad module audits, we:
1. **Take one TherAssistant endpoint** at a time
2. **Compare against OpenMRS equivalent** 
3. **Create replacement matrix** (field-by-field analysis)
4. **Build targeted adapter** (no UI changes needed)
5. **Deploy hybrid mode** (both systems work together)
6. **Defer full replacement** until needed

---

## Progress: ✅ Completed Analyses

### 1. Patient Roster
- **Status**: ✅ Matrix created + adapter implemented
- **File**: `docs/replacement-matrices/01-patient-roster.md`
- **Decision**: INTEGRATE (OpenMRS as optional secondary source)
- **Adapter**: `lib/openmrs-adapter/patient-search.ts`
- **Example Integration**: `docs/integration-examples/api-clients-hybrid.example.ts`
- **Effort**: 3-4 hours to implement (in progress)
- **Risk**: Low (read-only, deduplication, rollback with env flag)

### 2. Appointments
- **Status**: ✅ Matrix created
- **File**: `docs/replacement-matrices/02-appointments.md`
- **Decision**: HYBRID MODE (TherAssistant primary, OpenMRS secondary)
- **Adapter**: To build: `lib/openmrs-adapter/appointment-search.ts`
- **Effort**: 3-4 hours (search) + 2-3 hours (one-way sync)
- **Risk**: Medium (async sync, error handling, UUID tracking)

---

## Roadmap: Next 6 Priority Endpoints

### TIER 0: BLOCKING (Must work for MVP)

#### ✅ [1] Patient Roster: GET /api/clients
- **Priority**: Critical
- **Status**: Adapter complete
- **Next**: Integrate into actual route.ts (1 hour)

#### [ ] [2] Appointment Search: GET /api/patients/[clientId]/appointments
- **Priority**: Critical
- **Adapter**: appointment-search.ts (3-4 hours)
- **Features**: 
  - Read from OpenMRS /ws/rest/v1/appointment
  - Map to TherAssistant appointment format
  - Combine with Supabase appointments
  - Dedup by ID
- **Risk**: Low (read-only)
- **Env Flag**: `USE_OPENMRS_APPOINTMENTS=false` (default)

#### [ ] [3] Create Appointment: POST /api/scheduling/appointments/create
- **Priority**: Critical
- **Strategy**: Keep in TherAssistant, optionally sync
- **Adapter**: appointment-create-sync.ts (2-3 hours)
- **Features**:
  - Create in Supabase (unchanged)
  - Async: POST to OpenMRS /ws/rest/v1/appointment
  - Store OpenMRS UUID for later reference
  - Don't block on OpenMRS failure
- **Risk**: Medium (async background job)
- **Env Flag**: `SYNC_TO_OPENMRS_APPOINTMENTS=false` (default)

#### [ ] [4] Encounter Detail: GET /api/encounters/[encounterId]
- **Priority**: Critical
- **Status**: Need to analyze
- **Next**: Create replacement matrix (30 min)
- **Expected Decision**: Keep separate (OpenMRS encounter ≠ TherAssistant encounter)

### TIER 1: HIGH (Core functionality)

#### [ ] [5] Document Upload: POST /api/mailroom/upload
- **Priority**: High
- **Status**: Already working (Supabase only)
- **Next**: Create replacement matrix (30 min)
- **Expected Decision**: KEEP (OpenMRS attachments optional secondary)

#### [ ] [6] Diagnoses/Conditions: GET /api/patients/[clientId]/conditions
- **Priority**: High
- **Status**: Need to analyze
- **Next**: Create replacement matrix (30 min)
- **Expected Decision**: Hybrid (read from OpenMRS, keep TherAssistant custom fields)

### TIER 2: MEDIUM (Enhance existing)

#### [ ] [7] Vitals/Observations
#### [ ] [8] Medications  
#### [ ] [9] Allergies
#### [ ] [10] Visit History

---

## Concrete Implementation Schedule

### Week 1 (This Week)
- [x] Create patient roster matrix
- [x] Create appointments matrix
- [x] Implement patient-search.ts adapter
- [ ] **TODAY**: Integrate patient-search.ts into app/api/clients/route.ts (1 hour)
- [ ] Create appointment-search.ts adapter (3-4 hours)

### Week 2
- [ ] Test hybrid patient search against OpenMRS demo
- [ ] Create appointment-search.ts tests
- [ ] Create appointment-create-sync.ts adapter
- [ ] Encounter detail matrix + adapter
- [ ] Build 2-3 more matrices (mailroom, conditions, vitals)

### Week 3
- [ ] Full integration testing
- [ ] Performance testing (OpenMRS API latency impact)
- [ ] Error handling (graceful fallback if OpenMRS unavailable)
- [ ] Documentation updates
- [ ] Create deployment guide

---

## The Hybrid Pattern (Repeatable)

Every endpoint follows this template:

### Step 1: Create Replacement Matrix (30 min - 1 hour)
```
TherAssistant Field | OpenMRS Field | Replace? | Complexity | Risk
```

### Step 2: Implement Adapter (2-4 hours)
```typescript
// lib/openmrs-adapter/xxx-search.ts
export async function searchOpenMRS{{Feature}}(params) {
  // Fetch from OpenMRS REST API
  // Map to TherAssistant format
  // Return in same format as Supabase query
}

export function getOpenMRS{{Feature}}Config() {
  // Load env vars
  // Return null if disabled
}

export function deduplicateResults(results) {
  // Handle OpenMRS + Supabase overlap
}
```

### Step 3: Integrate into Existing Route (1 hour)
```typescript
// app/api/xxx/route.ts
const supabaseResults = await supabase.from("xxx").select(...);
const config = getOpenMRS{{Feature}}Config();
const openMrsResults = config ? await searchOpenMRS{{Feature}}(...) : [];
const allResults = deduplicateResults([...supabaseResults, ...openMrsResults]);
return NextResponse.json({ success: true, results: allResults });
```

### Step 4: Toggle & Test (1 hour)
- Set env: `USE_OPENMRS_{{FEATURE}}=true`
- Verify API still works
- Check deduplication
- Test fallback (disable OpenMRS, verify Supabase-only still works)
- Rollback: flip env flag back to `false`

---

## Why This Approach Wins

### ✅ Compared to "Replace Everything"
- **Risk**: Much lower (no UI rewrites, gradual swap)
- **Reversibility**: Easy (env flag)
- **Time to value**: Faster (1-2 endpoints per week vs all-or-nothing)
- **Testing**: Simpler (compare two sources side-by-side)
- **Production stability**: Higher (Supabase always available as fallback)

### ✅ Compared to "Audit All Modules"
- **Focus**: Specific endpoints, not abstract modules
- **Clarity**: Clear field mappings, not speculation
- **Implementation**: Concrete code, not recommendations
- **Validation**: Real API calls, not assumptions
- **Progress**: Visible weekly, not 3-month roadmap

---

## Success Metrics

### By End of Week 1
- ✅ Patient roster hybrid working
- ✅ Appointment search adapter ready
- 1-2 endpoints live with OpenMRS fallback

### By End of Week 2
- ✅ 4-6 endpoints hybrid-enabled
- ✅ All matrices created (TIER 0-1)
- ✅ No breaking changes to frontend
- ✅ Env flags allow per-org rollout

### By End of Week 3
- ✅ Full integration testing
- ✅ Performance benchmarked
- ✅ Deployment guide created
- ✅ Ready to flip OpenMRS live per organization

---

## Critical Implementation Details

### 1. Deduplication Strategy
```typescript
const merged = [...supabaseResults, ...openMrsResults];
const deduped = merged.filter((item, i) => {
  // Check if this item's ID already seen
  return !merged.slice(0, i).some(x => x.id === item.id);
});
```

### 2. Error Handling (Graceful Degradation)
```typescript
try {
  const openMrsResults = await searchOpenMRS(...);
  return [...supabaseResults, ...openMrsResults];
} catch (error) {
  console.warn("OpenMRS unavailable, returning Supabase only:", error);
  return supabaseResults; // Fallback always works
}
```

### 3. Env Flag Pattern
```typescript
const useOpenMrs = process.env.USE_OPENMRS_PATIENTS === "true";
const config = useOpenMrs ? getOpenMRSConfig() : null;
if (config) {
  // Hybrid mode
} else {
  // Supabase-only mode
}
```

### 4. Source Tracking
```typescript
const roster = supabaseClients.map(c => ({
  ...c,
  externalSource: "supabase",
  externalPatientUuid: null
}));
// Let frontend know where data came from
```

---

## Next Immediate Action

**Today**: Integrate patient-search.ts into app/api/clients/route.ts

1. Copy code from `docs/integration-examples/api-clients-hybrid.example.ts`
2. Apply to actual `app/api/clients/route.ts`
3. Set env: `USE_OPENMRS_PATIENTS=false` (keep default)
4. Verify: `npm run build && npm run lint`
5. Test: Call GET /api/clients?organizationId=xxx (should work as before)
6. When ready to enable: `USE_OPENMRS_PATIENTS=true` + OpenMRS API URL env vars

---

## Dependencies

- `lib/openmrs-adapter/transform.ts` ✅ (already exists)
- `lib/openmrs-adapter/types.ts` ✅ (already exists)
- `lib/openmrs-adapter/patient-search.ts` ✅ (implemented this session)
- `lib/openmrs-adapter/appointment-search.ts` (to implement)
- `lib/openmrs-adapter/appointment-create-sync.ts` (to implement)

All adapters independently testable. No frontend changes needed.

---

## Result

**By end of Month 1**: OpenMRS available as optional secondary source for all critical workflows, no UI changes, full fallback to Supabase if OpenMRS unavailable, can toggle per organization.
