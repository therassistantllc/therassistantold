import { Router } from "express";
import type { EncounterService } from "../services/interfaces";
import type { RequireRole } from "./auth";
import type { GetEncounterWorkspaceRequest } from "../../../shared/contracts";
import { asyncHandler, badRequest, ok } from "./http";

export function createEncounterRoutes(args: {
  encounterService: EncounterService;
  requireRole: RequireRole;
}): Router {
  const router = Router();
  const { encounterService, requireRole } = args;

  router.get(
    "/encounters/:encounterId/workspace",
    requireRole(["clinician", "supervisor", "billing_specialist", "admin", "super_admin"]),
    asyncHandler(async (req, res) => {
      const organization_id = String(req.query.organization_id || "").trim();
      const encounter_id = String(req.params.encounterId || "").trim();

      if (!organization_id) {
        return badRequest(res, "organization_id is required");
      }

      if (!encounter_id) {
        return badRequest(res, "encounterId is required");
      }

      const request: GetEncounterWorkspaceRequest = {
        organization_id,
        encounter_id,
      };

      const response = await encounterService.getEncounterWorkspace(request);
      return ok(res, response);
    }),
  );

  return router;
}
