# TherAssistant ↔ OpenMRS Appointments Replacement Matrix

## Current TherAssistant API: POST /api/scheduling/appointments/create

**File**: `app/api/scheduling/appointments/create/route.ts`  
**Data Source**: Supabase `appointments` table + series management  
**Features**: Create appointment, handle recurring series, return confirmation  

---

## OpenMRS Equivalent: POST /ws/rest/v1/appointment

**REST Endpoint**: `/openmrs/ws/rest/v1/appointment` (new in OpenMRS 3.2+)  
**Core Resource**: Appointment → AppointmentBlock (time slots)  
**Related**: Provider, Location, ServiceDefinition, AppointmentType  

---

## Field-by-Field Replacement Matrix

| TherAssistant Field | Current Source | OpenMRS Equivalent | Replace? | Complexity | Risk | Notes |
|---|---|---|---|---|---|---|
| `organizationId` | Request param | (Custom extension) | KEEP CUSTOM | — | — | OpenMRS has no org concept; TherAssistant-specific |
| `clientId` | Request body | `appointment.patient.uuid` | INTEGRATE | Low | Low | Direct mapping |
| `providerId` | Request body | `appointment.provider.uuid` | INTEGRATE | Low | Low | Direct mapping |
| `scheduledStartAt` | Request body (datetime) | `appointment.startDateTime` | INTEGRATE | Low | Low | Same ISO 8601 format |
| `scheduledEndAt` | Calculated (startAt + duration) | `appointment.endDateTime` | INTEGRATE | Low | Medium | TherAssistant calculates; OpenMRS expects explicit |
| `durationMinutes` | Request body | Calculated from start/end | INTEGRATE | Low | Medium | Reverse calculation needed |
| `appointmentType` | Request body (string) | `appointment.appointmentType.uuid` | INTEGRATE | Medium | Medium | OpenMRS uses typed AppointmentType resources |
| `reason` | Request body | `appointment.comments` or notes | INTEGRATE | Low | Low | OpenMRS stores in comments field |
| `serviceLocation` | Request body (enum) | `appointment.location` (custom attr?) | INTEGRATE | Medium | ⚠️ HIGH | OpenMRS locations don't natively support office/telehealth |
| `reminderEmailEnabled` | Request body | (N/A) | KEEP CUSTOM | — | — | TherAssistant-specific feature |
| `series/recurring` | Complex: appointment_series table | (N/A) | KEEP CUSTOM | — | — | OpenMRS doesn't handle recurring appointments |
| `status` | Enum in table | `appointment.status` (SCHEDULED, COMPLETED, CANCELLED, MISSED) | PARTIALLY | Medium | Medium | OpenMRS has fewer states; may need mapping |

---

## Request/Response Signature Comparison

### TherAssistant Request
```typescript
{
  organizationId: string;
  clientId: string;
  providerId: string;
  scheduledStartAt: string; // ISO datetime
  durationMinutes: number;
  appointmentType: string; // e.g., "Intake", "Follow-up"
  reason: string;
  serviceLocation: "office" | "telehealth";
  reminderEmailEnabled: boolean;
  // Optional recurring:
  seriesId?: string;
  recurrencePattern?: "weekly" | "biweekly" | "monthly";
  recurrenceEnd?: string;
}
```

### OpenMRS Request
```typescript
{
  patient: { uuid: string };
  service: { uuid: string }; // ServiceDefinition
  serviceType: { uuid: string };
  provider: { uuid: string };
  location: { uuid: string };
  appointmentType: { uuid: string };
  startDateTime: string; // ISO datetime
  endDateTime: string; // ISO datetime (NOT duration)
  comments?: string;
  appointmentNumber?: string;
}
```

### Response Mapping
| TherAssistant | OpenMRS | Notes |
|---|---|---|
| `appointmentIds: string[]` | `uuid: string` | TherAssistant returns array (series); OpenMRS returns single uuid |
| `success: boolean` | HTTP status | Different success indicators |
| `error?: string` | `error.message` | Error handling pattern differs |

---

## Complex Fields: Detailed Analysis

### 1. Service Location (office vs telehealth)
**Problem**: OpenMRS locations are physical places; don't natively support telehealth.

**Solutions**:
- **Option A**: Create two locations in OpenMRS ("Main Office", "Virtual")
  - Pros: Native OpenMRS
  - Cons: Not flexible; mixed with real locations
  
- **Option B**: Store in custom appointment attribute
  - Pros: Flexible; doesn't pollute location space
  - Cons: Requires OpenMRS custom attributes
  
- **Option C**: Keep in TherAssistant only (RECOMMENDED)
  - Pros: No conflicts; TherAssistant owns presentation
  - Cons: Not synced to OpenMRS
  - Verdict: ✅ Choose this; telehealth is not OpenMRS domain

### 2. Recurring Appointments
**Problem**: OpenMRS doesn't support recurring appointments.

**Solutions**:
- **Option A**: Keep in TherAssistant appointment_series table only
  - Pros: No data duplication; clean ownership
  - Cons: OpenMRS never sees series relationship
  
- **Option B**: Create separate OpenMRS appointments for each series instance
  - Pros: Each appointment visible in OpenMRS
  - Cons: Orphaned in OpenMRS if series changes
  
- **Option C**: Write series to OpenMRS custom attributes
  - Pros: Data preserved
  - Cons: OpenMRS can't use it; just storage
  
**Verdict**: ✅ Choose Option A; series is TherAssistant workflow, not OpenMRS concern

### 3. Appointment Status Mapping
| OpenMRS Status | TherAssistant Status | Bidirectional? |
|---|---|---|
| SCHEDULED | scheduled | ✅ |
| COMPLETED | completed | ✅ |
| CANCELLED | cancelled | ✅ |
| MISSED | no_show | ✅ |
| — | checked_in | ❌ NO OPENMRS EQUIVALENT |
| — | in_progress | ❌ NO OPENMRS EQUIVALENT |

**Decision**: Keep intermediate states (checked_in, in_progress) in TherAssistant only.

---

## Appointment Type Mapping

OpenMRS requires AppointmentType resources to exist in system.

| TherAssistant Type | OpenMRS AppointmentType | Mapping |
|---|---|---|
| "Intake" | `intake-type-uuid` | Must create if not exists |
| "Follow-up" | `followup-type-uuid` | Must create if not exists |
| "Evaluation" | `evaluation-type-uuid` | Must create if not exists |

**Implementation**: Create app/api/scheduling/appointment-types-sync.ts to keep in sync.

---

## Integration Strategy: Keep Separate (With Sync Points)

```
Frontend (/calendar, /clinician/agenda)
   ↓
TherAssistant /api/scheduling/appointments/create
   ↓
Supabase appointments + appointment_series (SOURCE OF TRUTH)
   ↓
Optional: Sync to OpenMRS (async, one-way)
   ↓
OpenMRS appointment (copy for patient/provider visibility)
```

### Why Not Replace?
1. **Recurring logic** - Only TherAssistant needs it
2. **Service location** - Not OpenMRS concept
3. **Intermediate states** - TherAssistant-specific workflow
4. **Ownership** - Appointments are tied to TherAssistant scheduling engine
5. **Fallback** - If OpenMRS unavailable, appointments still work

### Sync Strategy (One-Way)
```
TherAssistant creates appointment
   ↓ (async)
Trigger: POST /api/scheduling/appointments/sync/{appointmentId}
   ↓
Transform to OpenMRS format
   ↓
POST /openmrs/ws/rest/v1/appointment
   ↓
Store OpenMRS UUID in TherAssistant.appointments.external_appointment_ref
   ↓
If OpenMRS fails: log and continue (OpenMRS optional)
```

---

## Recommended Implementation Approach

### Phase 1: Read OpenMRS Appointments (Non-Breaking)
1. Create `lib/openmrs-adapter/appointment-search.ts`
   - Function: `searchOpenMRSAppointments(clientId, organizationId)`
   - Map OpenMRS appointment → TherAssistant format
   - Used for: `/api/patients/[clientId]/appointments` (GET)

2. Integrate into existing `/clinician/agenda`
   - Combine Supabase + OpenMRS appointments
   - Mark source: `externalSource: "supabase" | "openmrs"`
   - No frontend changes

### Phase 2: One-Way Sync (Supabase → OpenMRS)
1. Create `lib/openmrs-adapter/appointment-create-sync.ts`
   - When TherAssistant creates appointment
   - Optionally sync to OpenMRS (async, non-blocking)
   - Store OpenMRS UUID for later reference

2. Toggle with env: `SYNC_TO_OPENMRS_APPOINTMENTS=true`

### Phase 3: Accept OpenMRS Input (Later Phase)
- Only if OpenMRS is primary scheduling system
- Not recommended yet (Supabase more stable for billing workflows)

---

## Risk Analysis

### Low Risk
- ✅ Reading from OpenMRS appointments
- ✅ Mapping to TherAssistant format
- ✅ Displaying in combined list
- ✅ Marking data source

### Medium Risk
- ⚠️ One-way sync (async background job)
- ⚠️ Handling OpenMRS API downtime
- ⚠️ AppointmentType mapping (UUID handling)

### High Risk (Defer)
- ❌ Bidirectional sync (conflicts if both systems edit)
- ❌ Deleting appointments from OpenMRS
- ❌ Using OpenMRS as primary source

---

## Decision: HYBRID MODE (Read + Optional Sync)

**Verdict**: OpenMRS appointments are *secondary*, TherAssistant is *primary*.

**Implementation**:
1. Keep all appointment creation in TherAssistant
2. Optionally sync to OpenMRS (one-way)
3. Read OpenMRS appointments alongside TherAssistant
4. No frontend changes
5. Easy toggle on/off

**Rationale**:
- TherAssistant scheduling is production system
- OpenMRS is optional visibility layer
- Billing depends on TherAssistant appointments
- Can run independently if OpenMRS fails
- Gradual migration path

---

## Next Files to Compare

Once patient search and appointments are implemented:
1. **Encounters** (clinical notes)
2. **Documents/Attachments** (mailroom)
3. **Diagnoses/Conditions**
4. **Providers** (staff/credentials)

Each follows same pattern: analyze → matrix → implement adapter → hybrid mode.
