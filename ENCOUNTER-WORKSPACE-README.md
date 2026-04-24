# Encounter Workspace

## Overview

The Encounter Workspace is a comprehensive single-page interface for managing clinical encounters from appointment completion through billing. It serves as the operational hub for clinicians and billing staff to complete documentation, review coding readiness, and create claims.

## Purpose

Connect clinical completion to billing readiness by providing:
- Real-time view of encounter status
- Documentation completion tracking
- Coding and claim readiness evaluation  
- Clear visibility of billing blockers
- Direct actions for all encounter workflows

## Architecture

### Routes

- **Main Workspace**: `/sessions/[id]/page.tsx`
  - Single encounter view accessed by encounter ID
  - Loads all encounter data and presents unified interface
  
- **Note Editor**: `/sessions/[id]/note/page.tsx`
  - Clinical documentation workspace (placeholder)
  - Linked from encounter workspace

### Data Layer

**Types** (`lib/types/encounter.ts`):
- `EncounterWorkspace` - Main data structure
- `EncounterStatus` - Encounter lifecycle states
- `CodingReadiness` - Billing readiness evaluation
- `EncounterNote` - Documentation metadata
- `BillingAlert` - Client/insurance alerts
- `ClaimInfo` - Claim summary data

**Services** (`lib/data/encounter.ts`):
- `fetchEncounterWorkspace(encounterId)` - Load complete encounter data
- `performEncounterAction(request)` - Execute encounter actions
- Integrates with existing schedule and claim data

**Utilities** (`lib/data/schedule.ts`):
- `fetchAppointmentById(appointmentId)` - Retrieve appointment by ID or encounter ID
- Reuses existing gate logic and validation

### Components

All components located in `components/encounter/`:

1. **EncounterHeader**
   - Displays patient, provider, date/time
   - Shows encounter status, eligibility, and claim status
   - Provides high-level context

2. **ClientBillingSnapshot**
   - Client and insurance balances
   - Billing alerts with severity indicators
   - Prior authorization status (if applicable)
   - Link to full client profile

3. **DocumentationPanel**
   - Note status and type
   - Last modified/signed timestamps
   - Required fields completion
   - Diagnosis and service code presence
   - Action to open/start note

4. **CodingReadinessPanel**
   - Documented diagnoses with ICD codes
   - Service codes with modifiers and units
   - Rendering and billing provider info
   - Blockers preventing claim creation
   - Warnings for attention items

5. **ClaimPanel**
   - Claim number and status (if exists)
   - Billed amount and dates
   - Create claim button with blocker display
   - Prevents duplicate claims

6. **EncounterActionBar**
   - Sticky bottom bar with primary actions
   - Open Client, Open Note, Check Eligibility
   - Route to Biller, Collect Payment
   - Create/Open Claim (primary CTA)

## Integration Points

### From Schedule

Appointment rows now include "Open Encounter" button:
```tsx
<Link href={`/sessions/${appointment.encounterId}`}>
  Open Encounter
</Link>
```

### To Other Workflows

Actions route to appropriate pages:
- **Open Client** → `/patients/[clientId]`
- **Open Note** → `/sessions/[id]/note`
- **Collect Payment** → `/patients/[clientId]/collect`
- **Open Claim** → `/claims/[claimId]`
- **Check Eligibility** → Refreshes eligibility inline
- **Route to Biller** → Creates ticket (inline confirmation)

## Business Logic

### Encounter Status Derivation

Status flows through lifecycle:
1. `scheduled` - Initial state
2. `checked_in` - Patient arrived (future)
3. `in_progress` - Documentation started
4. `completed` - Documentation signed
5. `ready_to_bill` - All requirements met
6. `billed` - Claim submitted/accepted
7. `cancelled` / `no_show` - Non-completion states

### Claim Creation Gates

Claims can only be created when:
- ✅ Note is signed (not draft/in-progress)
- ✅ Required billing fields complete
- ✅ No existing claim for encounter
- ✅ Diagnoses documented
- ✅ Service codes present
- ✅ Providers assigned

Blockers are displayed clearly in both CodingReadinessPanel and ClaimPanel.

### Readiness Evaluation

Three states:
- **Ready** - All requirements met, no warnings
- **Warning** - Requirements met but with advisories (e.g., eligibility not recent)
- **Blocked** - Cannot create claim due to missing requirements

## Data Flow

1. User clicks "Open Encounter" from schedule
2. Page loads encounter data via `fetchEncounterWorkspace(encounterId)`
3. Components render current state with live data
4. User performs actions via buttons
5. Actions call `performEncounterAction()` with action type
6. Service executes action, returns result
7. Page refreshes data or redirects as needed
8. Success/error messages display inline

## Mock Data

Currently uses mock/demonstration data:
- Diagnoses: F41.1, F43.10 (when note signed)
- Service codes: 90834 with appropriate modifiers
- Provider NPIs and billing info
- Prior auth data (conditional)
- Billing alerts based on appointment state

## Future Expansion

The architecture supports:
- **Multiple note types** - Assessment, treatment plan, progress note
- **Advanced coding** - AI-suggested codes, modifier rules
- **Treatment plan integration** - Goals, objectives, interventions
- **Real-time collaboration** - Co-signature workflows
- **Audit trail** - Full edit history and compliance tracking
- **Mobile optimization** - Responsive encounter view
- **Batch operations** - Multi-encounter actions

## Development Notes

### Adding New Actions

1. Add action type to `EncounterActionRequest` in `encounter.ts`
2. Implement handler in `performEncounterAction()`
3. Add button to `EncounterActionBar`
4. Wire action in main page component

### Extending Readiness Logic

Edit `evaluateCodingReadiness()` in `lib/data/encounter.ts`:
- Add new blocker conditions
- Add warning conditions
- Update status calculation

### Creating New Panels

1. Create component in `components/encounter/`
2. Define props interface
3. Add to main workspace grid
4. Wire data and actions

## Testing Checklist

- [ ] Encounter loads from schedule link
- [ ] All panels display correct data
- [ ] Blockers prevent claim creation
- [ ] Actions navigate correctly
- [ ] Loading states work properly
- [ ] Error handling displays messages
- [ ] Eligibility check refreshes inline
- [ ] Claim creation prevents duplicates
- [ ] Mobile responsive layout
- [ ] Performance with real data volume

## Key Files

```
app/
  sessions/
    [id]/
      page.tsx              # Main encounter workspace
      note/
        page.tsx            # Note editor (placeholder)
      coding/
        page.tsx            # Legacy coding page

components/
  encounter/
    EncounterHeader.tsx
    ClientBillingSnapshot.tsx
    DocumentationPanel.tsx
    CodingReadinessPanel.tsx
    ClaimPanel.tsx
    EncounterActionBar.tsx

lib/
  types/
    encounter.ts            # All encounter types
  data/
    encounter.ts            # Data service and actions
    schedule.ts             # Extended with fetchAppointmentById
  utils/
    schedule.ts             # Shared utilities
```

## Success Metrics

The workspace successfully:
- ✅ Opens from scheduled appointments
- ✅ Shows complete encounter context
- ✅ Displays documentation status
- ✅ Evaluates coding readiness
- ✅ Prevents invalid claim creation
- ✅ Provides clear blocker messaging
- ✅ Supports all required actions
- ✅ Maintains existing design system
- ✅ Integrates with current data patterns
- ✅ Organized for future expansion
