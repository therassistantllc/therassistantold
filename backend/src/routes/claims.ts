import { Router } from "express";
import type { ClaimService } from "../services/interfaces";
import type { RequireRole } from "./auth";
import type {
  CreateClaimRequest,
  GetClaimByIdRequest,
  RunClaimStatusInquiryRequest,
} from "../../../shared/contracts";
import { asyncHandler, badRequest, ok } from "./http";

export function createClaimRoutes(args: {
  claimService: ClaimService;
  requireRole: RequireRole;
}): Router {
  const router = Router();
  const { claimService, requireRole } = args;

  router.get(
    "/claims/:claimId",
    requireRole(["billing_specialist", "supervisor", "admin", "super_admin", "clinician"]),
    asyncHandler(async (req, res) => {
      const organization_id = String(req.query.organization_id || "").trim();
      const claim_id = String(req.params.claimId || "").trim();

      if (!organization_id) {
        return badRequest(res, "organization_id is required");
      }

      if (!claim_id) {
        return badRequest(res, "claimId is required");
      }

      const request: GetClaimByIdRequest = {
        organization_id,
        claim_id,
      };

      const response = await claimService.getClaimById(request);
      return ok(res, response);
    }),
  );

  router.post(
    "/claims",
    requireRole(["billing_specialist", "supervisor", "admin", "super_admin"]),
    asyncHandler(async (req, res) => {
      const { organization_id, encounter_id, requested_by_user_id, force_rebuild_service_lines } =
        req.body || {};

      if (!organization_id || !encounter_id || !requested_by_user_id) {
        return badRequest(
          res,
          "organization_id, encounter_id, and requested_by_user_id are required",
        );
      }

      const request: CreateClaimRequest = {
        organization_id: String(organization_id),
        encounter_id: String(encounter_id),
        requested_by_user_id: String(requested_by_user_id),
        force_rebuild_service_lines: Boolean(force_rebuild_service_lines),
      };

      const response = await claimService.createClaim(request);
      return ok(res, response);
    }),
  );

  router.get(
    "/encounters/:encounterId/claim-readiness",
    requireRole(["billing_specialist", "supervisor", "admin", "super_admin", "clinician"]),
    asyncHandler(async (req, res) => {
      const organization_id = String(req.query.organization_id || "").trim();
      const encounter_id = String(req.params.encounterId || "").trim();

      if (!organization_id) {
        return badRequest(res, "organization_id is required");
      }

      if (!encounter_id) {
        return badRequest(res, "encounterId is required");
      }

      const response = await claimService.computeClaimReadiness(encounter_id, organization_id);
      return ok(res, response);
    }),
  );

  router.post(
    "/claims/:claimId/status-inquiry",
    requireRole(["billing_specialist", "supervisor", "admin", "super_admin"]),
    asyncHandler(async (req, res) => {
      const organization_id = String(req.body?.organization_id || "").trim();
      const requested_by_user_id = String(req.body?.requested_by_user_id || "").trim();
      const claim_id = String(req.params.claimId || "").trim();

      if (!organization_id || !requested_by_user_id || !claim_id) {
        return badRequest(
          res,
          "organization_id, requested_by_user_id, and claimId are required",
        );
      }

      const request: RunClaimStatusInquiryRequest = {
        organization_id,
        claim_id,
        requested_by_user_id,
      };

      const response = await claimService.runClaimStatusInquiry(request);
      return ok(res, response);
    }),
  );

  return router;
}
