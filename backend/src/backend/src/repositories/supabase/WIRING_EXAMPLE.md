# Repository wiring example

```ts
import { createSupabaseRepositories } from "./backend/src/repositories/supabase";
import {
  createBillingService,
  createClaimService,
  createEncounterService,
  createScheduleService,
  createWorkqueueService,
} from "./backend/src/services/factories";

const repos = createSupabaseRepositories();

const scheduleService = createScheduleService(repos);
const encounterService = createEncounterService(repos);
const claimService = createClaimService(repos);
const workqueueService = createWorkqueueService(repos);
const billingService = createBillingService(repos);
```

## Assumed canonical tables

- organizations
- clients
- appointments
- encounters
- encounter_notes
- encounter_diagnoses
- encounter_service_lines
- insurance_policies
- eligibility_checks
- authorization_or_referral
- claims
- claim_service_lines
- claim_submissions
- claim_status_inquiries
- workqueue_items
- billing_alerts
- support_tickets
- payment_postings

## Important

These mappers are the first real DB layer.
They assume your column names mostly match the shared contracts.
If your actual column names differ, patch the mapper, not the contract types.
