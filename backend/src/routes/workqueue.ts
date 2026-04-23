import { Router } from "express";
import type { WorkqueueService } from "../services/interfaces";
import type { RequireRole } from "./auth";
import type { RouteToBillerRequest, UpdateWorkqueueItemRequest } from "../../../shared/contracts";
import { asyncHandler, badRequest, ok } from "./http";

export function createWorkqueueRoutes(args: {
  workqueueService: WorkqueueService;
  requireRole: RequireRole;
}): Router {
  const router = Router();
  const { workqueueService, requireRole } = args;

  router.post(
    "/workqueue/route-to-biller",
    requireRole(["clinician", "supervisor", "billing_specialist", "admin", "super_admin"]),
    asyncHandler(async (req, res) => {
      const {
        organization_id,
        source_object_type,
        source_object_id,
        requested_by_user_id,
        priority,
        title,
        description,
        assigned_to_user_id,
        context_payload,
      } = req.body || {};

      if (!organization_id || !source_object_type || !source_object_id || !requested_by_user_id) {
        return badRequest(
          res,
          "organization_id, source_object_type, source_object_id, and requested_by_user_id are required",
        );
      }

      if (source_object_type !== "encounter" && source_object_type !== "claim") {
        return badRequest(res, "source_object_type must be encounter or claim");
      }

      const request: RouteToBillerRequest = {
        organization_id: String(organization_id),
        source_object_type,
        source_object_id: String(source_object_id),
        requested_by_user_id: String(requested_by_user_id),
        priority,
        title: title ? String(title) : undefined,
        description: description ? String(description) : undefined,
        assigned_to_user_id: assigned_to_user_id ? String(assigned_to_user_id) : null,
        context_payload: context_payload ?? undefined,
      };

      const response = await workqueueService.routeToBiller(request);
      return ok(res, response);
    }),
  );

  router.patch(
    "/workqueue/:workqueueItemId",
    requireRole(["billing_specialist", "supervisor", "admin", "super_admin"]),
    asyncHandler(async (req, res) => {
      const workqueue_item_id = String(req.params.workqueueItemId || "").trim();
      const {
        organization_id,
        requested_by_user_id,
        status,
        priority,
        assigned_to_user_id,
        due_at,
        title,
        description,
        context_payload,
      } = req.body || {};

      if (!organization_id || !requested_by_user_id || !workqueue_item_id) {
        return badRequest(
          res,
          "organization_id, requested_by_user_id, and workqueueItemId are required",
        );
      }

      const request: UpdateWorkqueueItemRequest = {
        organization_id: String(organization_id),
        workqueue_item_id,
        requested_by_user_id: String(requested_by_user_id),
        status,
        priority,
        assigned_to_user_id: assigned_to_user_id ? String(assigned_to_user_id) : null,
        due_at: due_at ?? null,
        title: title ?? undefined,
        description: description ?? null,
        context_payload: context_payload ?? undefined,
      };

      const response = await workqueueService.updateWorkqueueItem(request);
      return ok(res, response);
    }),
  );

  return router;
}
