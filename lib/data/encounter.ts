import {
  EncounterActionRequest,
  EncounterActionResult,
  EncounterWorkspace,
} from "@/lib/types/encounter";
import {
  createClaimViaApi,
  fetchEncounterWorkspaceFromApi,
  routeToBillerViaApi,
} from "@/lib/api/canonical";

export async function fetchEncounterWorkspace(encounterId: string): Promise<EncounterWorkspace | null> {
  return fetchEncounterWorkspaceFromApi(encounterId);
}

export async function performEncounterAction(request: EncounterActionRequest): Promise<EncounterActionResult> {
  switch (request.action) {
    case "open_client":
      return {
        success: true,
        redirect: `/patients/${String(request.metadata?.clientId || "")}`,
      };

    case "open_note":
      return {
        success: true,
        message: "Opening clinical note...",
        redirect: `/sessions/${request.encounterId}/note`,
      };

    case "check_eligibility":
      return {
        success: true,
        message: "Eligibility action will be connected to canonical workflow next.",
      };

    case "route_to_biller": {
      const routed = await routeToBillerViaApi({
        sourceObjectType: "encounter",
        sourceObjectId: request.encounterId,
      });
      return {
        success: true,
        message: routed.workqueueItemId
          ? `Ticket ${routed.workqueueItemId} created for billing team`
          : "Ticket created for billing team",
      };
    }

    case "collect":
      return {
        success: true,
        redirect: `/patients/${String(request.metadata?.clientId || "")}/collect`,
      };

    case "create_claim": {
      const created = await createClaimViaApi(request.encounterId);
      if (!created.claimId) {
        return {
          success: false,
          error: created.blockers?.join(" ") || "Claim creation blocked",
        };
      }
      return {
        success: true,
        message: "Claim created successfully",
        redirect: `/claims/${created.claimId}`,
      };
    }

    case "open_claim":
      return {
        success: true,
        redirect: `/claims/${String(request.metadata?.claimId || "")}`,
      };

    default:
      return {
        success: false,
        error: "Unknown action",
      };
  }
}
