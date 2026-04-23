import type { PaymentAllocationInput, PaymentPostingRecord, PostPaymentRequest, ReadinessResult } from "../../../shared/contracts";
import { addBlocker, addWarning, emptyReadiness, finalizeReadiness, hasAnyAllocationTargets, isBlank, isPositiveMoneyString, makeRule } from "./common";

export interface ValidatePaymentPostingInput {
  request: PostPaymentRequest;
  existing_posting?: PaymentPostingRecord | null;
}

function sumAllocations(allocations: PaymentAllocationInput[]): number {
  return allocations.reduce((sum, allocation) => sum + (Number(allocation.allocated_amount || "0") || 0), 0);
}

export function validatePaymentPosting(input: ValidatePaymentPostingInput): ReadinessResult {
  const result = emptyReadiness();
  const { request, existing_posting } = input;

  if (isBlank(request.posting_reference)) addBlocker(result, makeRule({
    rule_code: "PAYMENT_POSTING_REFERENCE_MISSING", severity: "blocker", message: "Posting reference is required.",
    source_object_type: "payment_posting", source_object_id: null, field_path: "posting_reference",
  }));

  if (request.allocations.length === 0) addBlocker(result, makeRule({
    rule_code: "PAYMENT_ALLOCATIONS_MISSING", severity: "blocker", message: "At least one payment allocation is required.",
    source_object_type: "payment_posting", source_object_id: null, field_path: "allocations",
  }));

  request.allocations.forEach((allocation, index) => {
    if (!hasAnyAllocationTargets(allocation)) addBlocker(result, makeRule({
      rule_code: "PAYMENT_ALLOCATION_TARGET_MISSING", severity: "blocker",
      message: "Each allocation must target a claim, line, encounter, or client.",
      source_object_type: "payment_posting", source_object_id: null, field_path: `allocations[${index}]`,
    }));
    if (!isPositiveMoneyString(allocation.allocated_amount)) addBlocker(result, makeRule({
      rule_code: "PAYMENT_ALLOCATION_AMOUNT_INVALID", severity: "blocker", message: "Allocation amount must be greater than zero.",
      source_object_type: "payment_posting", source_object_id: null, field_path: `allocations[${index}].allocated_amount`,
    }));
  });

  if (sumAllocations(request.allocations) <= 0) addBlocker(result, makeRule({
    rule_code: "PAYMENT_TOTAL_INVALID", severity: "blocker", message: "Total posted amount must be greater than zero.",
    source_object_type: "payment_posting", source_object_id: null,
  }));

  if (existing_posting) addWarning(result, makeRule({
    rule_code: "PAYMENT_POSTING_REFERENCE_EXISTS", severity: "warning",
    message: "Posting reference already exists and may indicate a duplicate post.",
    source_object_type: "payment_posting", source_object_id: existing_posting.id,
  }));

  return finalizeReadiness(result);
}
