import type { PaymentAllocationInput, ReadinessResult, RouteToBillerRequest, RuleMessage, Severity } from "../../../shared/contracts";

export type SourceObjectType = RuleMessage["source_object_type"];

export function makeRule(args: {
  rule_code: string;
  severity: Severity;
  message: string;
  source_object_type: SourceObjectType;
  source_object_id: string | null;
  field_path?: string;
}): RuleMessage {
  return { ...args };
}

export function emptyReadiness(): ReadinessResult {
  return { is_ready: true, blockers: [], warnings: [] };
}

export function finalizeReadiness(result: ReadinessResult): ReadinessResult {
  return { ...result, is_ready: result.blockers.length === 0 };
}

export function addBlocker(result: ReadinessResult, rule: RuleMessage): void {
  result.blockers.push(rule);
  result.is_ready = false;
}

export function addWarning(result: ReadinessResult, rule: RuleMessage): void {
  result.warnings.push(rule);
}

export function isBlank(value: unknown): boolean {
  return value == null || (typeof value === "string" && value.trim().length === 0);
}

export function isPositiveMoneyString(value: string | null | undefined): boolean {
  if (isBlank(value)) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

export function hasValue<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

export function hasAnyAllocationTargets(input: PaymentAllocationInput): boolean {
  return Boolean(input.claim_id || input.claim_service_line_id || input.encounter_id || input.client_id);
}

export function routeTitleForRequest(request: RouteToBillerRequest): string {
  if (request.title && request.title.trim()) return request.title.trim();
  return request.source_object_type === "claim"
    ? "Claim requires billing follow-up"
    : "Encounter requires billing review";
}
