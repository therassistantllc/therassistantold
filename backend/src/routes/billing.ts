import { Router } from "express";
import type { BillingService } from "../services/interfaces";
import type { RequireRole } from "./auth";
import type { PostPaymentRequest } from "../../../shared/contracts";
import { asyncHandler, badRequest, ok } from "./http";

export function createBillingRoutes(args: {
  billingService: BillingService;
  requireRole: RequireRole;
}): Router {
  const router = Router();
  const { billingService, requireRole } = args;

  router.post(
    "/billing/post-payment",
    requireRole(["billing_specialist", "supervisor", "admin", "super_admin"]),
    asyncHandler(async (req, res) => {
      const { organization_id, requested_by_user_id, payment_import_item_id, posting_reference, allocations } =
        req.body || {};

      if (!organization_id || !requested_by_user_id || !posting_reference) {
        return badRequest(
          res,
          "organization_id, requested_by_user_id, and posting_reference are required",
        );
      }

      const request: PostPaymentRequest = {
        organization_id: String(organization_id),
        requested_by_user_id: String(requested_by_user_id),
        payment_import_item_id: payment_import_item_id ? String(payment_import_item_id) : undefined,
        posting_reference: String(posting_reference),
        allocations: Array.isArray(allocations) ? allocations : [],
      };

      const response = await billingService.postPayment(request);
      return ok(res, response);
    }),
  );

  router.get(
    "/billing/unposted-payments",
    requireRole(["billing_specialist", "supervisor", "admin", "super_admin", "clinician"]),
    asyncHandler(async (req, res) => {
      const organization_id = String(req.query.organization_id || "").trim();
      if (!organization_id) {
        return badRequest(res, "organization_id is required");
      }

      const payments = await billingService.getUnpostedPayments(organization_id);
      return ok(res, { payments });
    }),
  );

  router.get(
    "/billing/ready-to-submit",
    requireRole(["billing_specialist", "supervisor", "admin", "super_admin", "clinician"]),
    asyncHandler(async (req, res) => {
      const organization_id = String(req.query.organization_id || "").trim();
      if (!organization_id) {
        return badRequest(res, "organization_id is required");
      }

      const claims = await billingService.getReadyToSubmitClaims(organization_id);
      return ok(res, { claims });
    }),
  );

  router.get(
    "/billing/batches",
    requireRole(["billing_specialist", "supervisor", "admin", "super_admin", "clinician"]),
    asyncHandler(async (req, res) => {
      const organization_id = String(req.query.organization_id || "").trim();
      if (!organization_id) {
        return badRequest(res, "organization_id is required");
      }

      const batches = await billingService.getSubmissionBatches(organization_id);
      return ok(res, { batches });
    }),
  );

  router.get(
    "/billing/client-snapshot/:clientId",
    requireRole(["billing_specialist", "supervisor", "admin", "super_admin", "clinician"]),
    asyncHandler(async (req, res) => {
      const organization_id = String(req.query.organization_id || "").trim();
      const client_id = String(req.params.clientId || "").trim();

      if (!organization_id || !client_id) {
        return badRequest(res, "organization_id and clientId are required");
      }

      const response = await billingService.getBillingSnapshot(organization_id, client_id);
      return ok(res, response);
    }),
  );

  return router;
}
