# Route wiring example

Add these routes to your Express server after you create the services.

```ts
import { createApiRouter } from "./backend/src/routes";
import {
  createBillingService,
  createClaimService,
  createEncounterService,
  createScheduleService,
  createWorkqueueService,
} from "./backend/src/services/factories";

// build repository bundle first
const repos = {
  scheduleRepository,
  encounterRepository,
  clientRepository,
  insuranceRepository,
  claimRepository,
  workqueueRepository,
  alertRepository,
  ticketRepository,
  paymentRepository,
};

const encounterService = createEncounterService(repos);
const claimService = createClaimService(repos);
const workqueueService = createWorkqueueService(repos);
const billingService = createBillingService(repos);

app.use(
  "/api",
  createApiRouter({
    encounterService,
    claimService,
    workqueueService,
    billingService,
    requireRole, // your existing server.js middleware factory
  }),
);
```

These routes assume your shared contracts live at:

```text
shared/contracts/index.ts
```
