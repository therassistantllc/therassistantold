import { Router } from "express";
import type {
  BillingService,
  ClaimService,
  EncounterService,
  WorkqueueService,
} from "../services/interfaces";
import type { RequireRole } from "./auth";
import { createBillingRoutes } from "./billing";
import { createClaimRoutes } from "./claims";
import { createEncounterRoutes } from "./encounters";
import { createWorkqueueRoutes } from "./workqueue";

export function createApiRouter(args: {
  encounterService: EncounterService;
  claimService: ClaimService;
  workqueueService: WorkqueueService;
  billingService: BillingService;
  requireRole: RequireRole;
}): Router {
  const router = Router();

  router.use(createEncounterRoutes({
    encounterService: args.encounterService,
    requireRole: args.requireRole,
  }));

  router.use(createClaimRoutes({
    claimService: args.claimService,
    requireRole: args.requireRole,
  }));

  router.use(createWorkqueueRoutes({
    workqueueService: args.workqueueService,
    requireRole: args.requireRole,
  }));

  router.use(createBillingRoutes({
    billingService: args.billingService,
    requireRole: args.requireRole,
  }));

  return router;
}
