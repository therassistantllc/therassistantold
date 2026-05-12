import {
  createProfessionalClaimDraft,
  validateProfessionalClaimReadiness,
  type BillingProviderInput,
  type ClaimServiceLineInput,
} from "@/lib/claims/claimReadinessService";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

type DbRow = Record<string, unknown>;

export interface CreateClaimFromChargeCaptureInput {
  organizationId: string;
  chargeCaptureId: string;
}

export interface CreateClaimFromChargeCaptureResult {
  ok: boolean;
  claimId: string | null;
  errors: Array<{ field: string; message: string }>;
}

function text(value: unknown) {
  return String(value ?? "").trim();
}

function money(value: unknown) {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : 0;
}

function readArray(value: unknown): DbRow[] {
  return Array.isArray(value) ? (value as DbRow[]) : [];
}

function readTextArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function billingProviderFromOrganization(org: DbRow): BillingProviderInput {
  return {
    name: text(org.billing_provider_name) || text(org.name),
    npi: text(org.billing_provider_npi) || text(org.npi),
    taxId: text(org.billing_provider_tax_id) || text(org.tax_id),
    taxIdType: text(org.billing_provider_tax_id_type) === "SY" ? "SY" : "EI",
    address1: text(org.billing_address_line_1) || text(org.address_line_1),
    address2: text(org.billing_address_line_2) || text(org.address_line_2) || null,
    city: text(org.billing_city) || text(org.city),
    state: text(org.billing_state) || text(org.state),
    zip: text(org.billing_postal_code) || text(org.postal_code),
  };
}

function serviceLinesFromCharge(charge: DbRow): ClaimServiceLineInput[] {
  return readArray(charge.service_lines).map((line, index) => ({
    serviceDate: text(line.serviceDate) || text(charge.service_date),
    procedureCode: text(line.procedureCode),
    modifiers: readTextArray(line.modifiers),
    units: Number(line.units ?? 1) || 1,
    chargeAmount: money(line.chargeAmount),
    diagnosisPointers: ["1"],
    placeOfService: text(line.placeOfService) || text(charge.place_of_service) || null,
    renderingProviderNpi: text(line.renderingProviderNpi) || null,
    authorizationNumber: text(line.authorizationNumber) || null,
  })).filter((line) => line.procedureCode && line.chargeAmount > 0 && line.serviceDate);
}

export async function createClaimDraftFromChargeCapture(
  input: CreateClaimFromChargeCaptureInput,
): Promise<CreateClaimFromChargeCaptureResult> {
  const supabase = createServerSupabaseAdminClient();
  if (!supabase) {
    return { ok: false, claimId: null, errors: [{ field: "system", message: "Database connection not available" }] };
  }

  const { data: charge, error: chargeError } = await supabase
    .from("charge_capture_items")
    .select("id, organization_id, encounter_id, client_id, appointment_id, insurance_policy_id, charge_status, service_date, diagnosis_codes, service_lines, place_of_service")
    .eq("organization_id", input.organizationId)
    .eq("id", input.chargeCaptureId)
    .is("archived_at", null)
    .maybeSingle();

  if (chargeError || !charge) {
    return { ok: false, claimId: null, errors: [{ field: "charge_capture_items", message: "Charge capture item not found" }] };
  }

  if (charge.charge_status !== "ready_for_claim") {
    return { ok: false, claimId: null, errors: [{ field: "charge_status", message: "Charge capture item is not ready for claim creation" }] };
  }

  const { data: existingClaim } = await supabase
    .from("professional_claims")
    .select("id")
    .eq("organization_id", input.organizationId)
    .eq("appointment_id", charge.appointment_id)
    .eq("patient_id", charge.client_id)
    .neq("claim_status", "voided")
    .limit(1)
    .maybeSingle();

  if (existingClaim?.id) {
    const readiness = await validateProfessionalClaimReadiness(String(existingClaim.id), input.organizationId);
    return { ok: readiness.ok, claimId: String(existingClaim.id), errors: readiness.errors };
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", input.organizationId)
    .maybeSingle();

  if (!org) {
    return { ok: false, claimId: null, errors: [{ field: "organization", message: "Organization settings not found" }] };
  }

  const draft = await createProfessionalClaimDraft({
    organizationId: input.organizationId,
    clientId: String(charge.client_id),
    policyId: charge.insurance_policy_id ? String(charge.insurance_policy_id) : null,
    appointmentId: charge.appointment_id ? String(charge.appointment_id) : null,
    placeOfService: text(charge.place_of_service) || null,
    diagnosisCodes: readTextArray(charge.diagnosis_codes),
    serviceLines: serviceLinesFromCharge(charge as DbRow),
    billingProvider: billingProviderFromOrganization(org as DbRow),
    patientAccountNumber: charge.encounter_id ? `ENC-${String(charge.encounter_id).slice(0, 8)}` : null,
    claimNumber: `CLM-${String(charge.id).slice(0, 8)}`,
  });

  if (!draft.ok || !draft.claimId) return draft;

  await supabase
    .from("charge_capture_items")
    .update({ charge_status: "claim_created", updated_at: new Date().toISOString() })
    .eq("organization_id", input.organizationId)
    .eq("id", input.chargeCaptureId);

  const readiness = await validateProfessionalClaimReadiness(draft.claimId, input.organizationId);
  return { ok: readiness.ok, claimId: draft.claimId, errors: readiness.errors };
}
