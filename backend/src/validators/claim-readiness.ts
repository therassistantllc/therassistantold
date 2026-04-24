import type {
  AuthorizationSummary,
  ClaimReadinessResult,
  ClaimRecord,
  EligibilityCheckSummary,
  EncounterDiagnosisRecord,
  EncounterNoteRecord,
  EncounterRecord,
  EncounterServiceLineRecord,
  InsurancePolicySummary,
} from "../../../shared/contracts";
import { validateEncounterCompletion } from "./encounter-readiness";
import { addBlocker, addWarning, emptyReadiness, finalizeReadiness, isBlank, makeRule } from "./common";

export interface ValidateClaimCreationInput {
  encounter: EncounterRecord;
  note: EncounterNoteRecord | null;
  diagnoses: EncounterDiagnosisRecord[];
  service_lines: EncounterServiceLineRecord[];
  insurance_policy: InsurancePolicySummary | null;
  latest_eligibility: EligibilityCheckSummary | null;
  active_authorization: AuthorizationSummary | null;
  existing_claim: ClaimRecord | null;
  duplicate_detection_key: string | null;
}

export function validateClaimCreation(input: ValidateClaimCreationInput): ClaimReadinessResult {
  const base = validateEncounterCompletion(input);
  const result: ClaimReadinessResult = {
    ...emptyReadiness(),
    encounter_id: input.encounter.id,
    candidate_claim_id: input.existing_claim?.id ?? null,
    duplicate_detection_key: input.duplicate_detection_key,
    blockers: [...base.blockers],
    warnings: [...base.warnings],
  };

  if (input.existing_claim) addBlocker(result, makeRule({
    rule_code: "CLAIM_DUPLICATE_ENCOUNTER", severity: "blocker", message: "A claim already exists for this encounter.",
    source_object_type: "claim", source_object_id: input.existing_claim.id,
  }));

  if (!input.insurance_policy) {
    addBlocker(result, makeRule({
      rule_code: "CLAIM_INSURANCE_POLICY_MISSING", severity: "blocker", message: "An insurance policy is required before claim creation.",
      source_object_type: "encounter", source_object_id: input.encounter.id,
    }));
  } else if (isBlank(input.insurance_policy.payer_id)) {
    addBlocker(result, makeRule({
      rule_code: "CLAIM_PAYER_ID_MISSING", severity: "blocker", message: "Insurance payer ID is required before claim creation.",
      source_object_type: "insurance_policy", source_object_id: input.insurance_policy.id, field_path: "payer_id",
    }));
  }

  const totalCharges = input.service_lines.reduce((sum, line) => sum + (Number(line.charge_amount || "0") || 0), 0);
  if (!(totalCharges > 0)) addBlocker(result, makeRule({
    rule_code: "CLAIM_TOTAL_CHARGE_INVALID", severity: "blocker", message: "Claim total charges must be greater than zero.",
    source_object_type: "encounter", source_object_id: input.encounter.id,
  }));

  const dateOfService = (input.encounter as any).date_of_service || (input.encounter as any).service_date;
  if (!dateOfService) addBlocker(result, makeRule({
    rule_code: "CLAIM_DATE_OF_SERVICE_MISSING", severity: "blocker", message: "Date of service is required before claim creation.",
    source_object_type: "encounter", source_object_id: input.encounter.id, field_path: "date_of_service",
  }));

  if (!input.duplicate_detection_key || input.duplicate_detection_key.trim().length === 0) addBlocker(result, makeRule({
    rule_code: "CLAIM_DUPLICATE_KEY_MISSING", severity: "blocker", message: "Duplicate submission key could not be generated.",
    source_object_type: "encounter", source_object_id: input.encounter.id,
  }));

  if (!input.latest_eligibility) addWarning(result, makeRule({
    rule_code: "ELIGIBILITY_MISSING", severity: "warning", message: "No eligibility check is on file.",
    source_object_type: "encounter", source_object_id: input.encounter.id,
  }));
  else if (input.latest_eligibility.eligibility_stale) addWarning(result, makeRule({
    rule_code: "ELIGIBILITY_STALE_30D", severity: "warning", message: "Eligibility is older than 30 days.",
    source_object_type: "eligibility_check", source_object_id: input.latest_eligibility.id,
  }));

  if (input.active_authorization && !["approved", "not_required"].includes(input.active_authorization.authorization_status)) {
    addWarning(result, makeRule({
      rule_code: "AUTH_REQUIRED_NOT_APPROVED", severity: "warning", message: "Authorization/referral may be required and is not approved.",
      source_object_type: "authorization_or_referral", source_object_id: input.active_authorization.id,
    }));
  }

  return finalizeReadiness(result) as ClaimReadinessResult;
}
