import type { ClaimRecord, EncounterRecord, ReadinessResult, RouteToBillerRequest, WorkqueueItemRecord } from "../../../shared/contracts";
import { addBlocker, addWarning, emptyReadiness, finalizeReadiness, hasValue, makeRule, routeTitleForRequest } from "./common";

export interface ValidateRouteToBillerInput {
  request: RouteToBillerRequest;
  encounter?: EncounterRecord | null;
  claim?: ClaimRecord | null;
  existing_open_workqueue_item?: WorkqueueItemRecord | null;
}

export function validateRouteToBiller(input: ValidateRouteToBillerInput): ReadinessResult {
  const result = emptyReadiness();
  const { request, encounter, claim, existing_open_workqueue_item } = input;

  if (request.source_object_type === "encounter" && !encounter) {
    addBlocker(result, makeRule({
      rule_code: "ROUTE_ENCOUNTER_NOT_FOUND", severity: "blocker", message: "Encounter was not found.",
      source_object_type: "encounter", source_object_id: request.source_object_id,
    }));
  }

  if (request.source_object_type === "claim" && !claim) {
    addBlocker(result, makeRule({
      rule_code: "ROUTE_CLAIM_NOT_FOUND", severity: "blocker", message: "Claim was not found.",
      source_object_type: "claim", source_object_id: request.source_object_id,
    }));
  }

  if (hasValue(existing_open_workqueue_item)) addWarning(result, makeRule({
    rule_code: "ROUTE_EXISTING_OPEN_WORK_ITEM", severity: "warning", message: "An open workqueue item already exists for this source object.",
    source_object_type: "workqueue_item", source_object_id: existing_open_workqueue_item.id,
  }));

  if (routeTitleForRequest(request).length < 5) addBlocker(result, makeRule({
    rule_code: "ROUTE_TITLE_INVALID", severity: "blocker", message: "Workqueue title is required.",
    source_object_type: request.source_object_type, source_object_id: request.source_object_id,
  }));

  return finalizeReadiness(result);
}
