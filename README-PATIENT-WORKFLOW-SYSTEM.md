# Patient Workflow System

Complete patient journey implementation from appointment through payment.

## Workflow Architecture

```
┌─────────────┐
│ Appointment │  createAppointment(patientId)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Encounter  │  createEncounter({ appointmentId, patientId })
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Note     │  createNote({ encounterId, status: "signed" })
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    Claim    │  createClaim({ encounterId, status: "ready_to_submit" })
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Submission │  submitClaim(claimId)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Payment   │  postPayment({ claimId, amount: 100 })
└─────────────┘
```

## Core Workflow Functions

Located in: `/lib/workflow/workflowActions.ts`

### 1. Create Appointment
```typescript
await createAppointment(supabase, {
  patientId: string,
  providerId: string,
  appointmentType: string,
  scheduledStartAt: string,
  scheduledEndAt: string,
  notes?: string
})
```

### 2. Create Encounter
```typescript
await createEncounter(supabase, {
  appointmentId: string,
  patientId: string,
  dateOfService?: string,
  placeOfServiceCode?: string
})
```

### 3. Create Clinical Note
```typescript
await createNote(supabase, {
  encounterId: string,
  subjective?: string,
  objective?: string,
  assessment?: string,
  plan?: string,
  status: "draft" | "signed",
  riskNotes?: string,
  sessionSummary?: string
})
```

### 4. Create Claim
```typescript
await createClaim(supabase, {
  encounterId: string,
  status?: string
})
```

### 5. Submit Claim
```typescript
await submitClaim(supabase, claimId: string)
```

### 6. Post Payment
```typescript
await postPayment(supabase, {
  claimId: string,
  amount: number,
  paymentType?: "insurance_payment" | "patient_payment",
  checkNumber?: string
})
```

## Testing the Complete Workflow

Run the end-to-end test:

```bash
npm run test:workflow
```

Or directly:

```bash
npx tsx scripts/test-complete-workflow.ts
```

This will:
1. ✅ Create a test appointment
2. ✅ Generate encounter from appointment
3. ✅ Create and sign clinical note
4. ✅ Generate claim with service lines
5. ✅ Submit claim to clearinghouse
6. ✅ Post insurance payment

### Expected Output

```
🚀 Starting Complete Patient Workflow Test
==========================================

📅 Step 1: Creating appointment...
✅ Appointment created: [UUID]

🏥 Step 2: Creating encounter...
✅ Encounter created: [UUID]

📝 Step 3: Creating clinical note...
✅ Note created and signed: [UUID]

💰 Step 4: Creating claim...
✅ Claim created: [UUID]
   Status: ready_to_submit
   Amount: $150.00

📤 Step 5: Submitting claim to clearinghouse...
✅ Claim submitted: [UUID]

💵 Step 6: Posting payment...
✅ Payment posted: [UUID]
   Amount: $100.00

✅ WORKFLOW COMPLETED SUCCESSFULLY!
```

## Using in API Endpoints

Example: Create API endpoint for workflow automation

```typescript
// app/api/workflow/complete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { executeCompleteWorkflow } from "@/lib/workflow/workflowActions";

export async function POST(request: NextRequest) {
  const { patientId, providerId } = await request.json();
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role for server
  );
  
  try {
    const result = await executeCompleteWorkflow(
      supabase,
      patientId,
      providerId
    );
    
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

## Using in Server Components

```typescript
import { createClient } from "@/lib/supabase/server";
import { createEncounter, createNote } from "@/lib/workflow/workflowActions";

async function handleEncounterCreation(appointmentId: string, patientId: string) {
  const supabase = await createClient();
  
  // Create encounter
  const encounter = await createEncounter(supabase, {
    appointmentId,
    patientId
  });
  
  // Optionally create draft note
  const note = await createNote(supabase, {
    encounterId: encounter.id,
    status: "draft"
  });
  
  return { encounter, note };
}
```

## Integration with Patient Workspace

The Patient Workspace (`/patients/[id]`) now connects seamlessly with this workflow:

1. **Overview Tab**: Shows current workflow status using `deriveEncounterWorkflowStatus()`
2. **Appointments Tab**: Click appointment → Sets context → Create encounter button
3. **Encounters Tab**: Click encounter → Navigate to note editor
4. **Claims Tab**: Shows claim status → Payment posting actions
5. **Payments Tab**: Lists all payments linked to claims

## Active Context Integration

All workflow actions automatically work with the Global Active Context:

```typescript
import { useActiveContext } from "@/lib/store/activeContext";

function EncounterCreator() {
  const { patientId, appointmentId } = useActiveContext();
  
  async function handleCreate() {
    if (!patientId || !appointmentId) {
      alert("Please select a patient and appointment first");
      return;
    }
    
    const response = await fetch("/api/encounters", {
      method: "POST",
      body: JSON.stringify({ patientId, appointmentId })
    });
    
    // Context persists across navigation
  }
  
  return <button onClick={handleCreate}>Create Encounter</button>;
}
```

## Validation Rules

The workflow enforces these rules:

1. **Encounter** requires: Patient + Appointment
2. **Note** requires: Encounter
3. **Claim** requires: Encounter + Signed Note + Active Insurance
4. **Submission** requires: Claim in "ready_to_submit" status
5. **Payment** requires: Submitted Claim

## Error Handling

All functions throw descriptive errors:

```typescript
try {
  await createClaim(supabase, { encounterId });
} catch (error) {
  // Error example: "Failed to create claim: No active insurance found for patient"
  console.error(error.message);
}
```

## Next Steps

1. **Create API Routes**: Turn workflow functions into REST endpoints
2. **Add Background Jobs**: Auto-submit claims, check payment status
3. **Build Automation**: Trigger workflows based on events (note signed → create claim)
4. **Add Notifications**: Alert staff when workflow steps complete/fail
5. **Extend Testing**: Add unit tests for each workflow function

## Files Created

- `/lib/workflow/workflowActions.ts` - Core workflow functions
- `/scripts/test-complete-workflow.ts` - End-to-end test script
- This README - Documentation

## Dependencies

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.104.1"
  },
  "devDependencies": {
    "tsx": "^4.19.2",
    "dotenv": "^16.4.5"
  }
}
```

Install: `npm install`

---

**Built with**: Next.js 16, Supabase, TypeScript, Global Active Context System
