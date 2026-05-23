/**
 * Payment Posting Engine — manual_insurance source (Task #109).
 *
 * Posts a paper EOB / VCC / mailed-check / payer-portal insurance payment
 * against a professional claim. Mirrors the ERA 835 path:
 *   validation → insert insurance_manual_payments → write ledger rows
 *   → update claim balances → create patient invoice when PR > 0 → audit.
 *
 * Validation parallels validateEra835Posting at the claim grain:
 *   paid + adjustments + patient_resp must equal total_charge (±1¢).
 */

import crypto from "crypto";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { writePaymentAuditLog } from "./audit";
import { POSTING_BALANCE_TOLERANCE } from "./validation";
import type {
  CommitPostingResult,
  PostingActor,
  PostingSource,
  ValidationIssue,
  ValidationResult,
} from "./types";

type ManualInsuranceSource = Extract<PostingSource, { type: "manual_insurance" }> & {
  totalChargeAmount?: number | null;
  eobReference?: string | null;
  mailroomItemId?: string | null;
  payerProfileId?: string | null;
  note?: string | null;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function genId() {
  return typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function invoiceNumber(paymentId: string) {
  return `MAN-${paymentId.slice(0, 8).toUpperCase()}`;
}

export interface ManualInsuranceHydratedClaim {
  id: string;
  organization_id: string;
  patient_id: string | null;
  total_charge_amount: number | null;
  payer_responsibility_amount?: number | null;
  patient_responsibility_amount?: number | null;
  claim_status: string;
}

export function validateManualInsurancePosting(
  src: ManualInsuranceSource,
  claim: ManualInsuranceHydratedClaim | null,
): ValidationResult {
  const blocking: ValidationIssue[] = [];
  const warning: ValidationIssue[] = [];

  if (!claim) {
    blocking.push({
      severity: "blocking",
      code: "claim_not_found",
      field: "professionalClaimId",
      message: "Claim not found or not in this organization.",
    });
    return { blocking, warning };
  }

  const paid = Number(src.payerPaymentAmount ?? 0);
  const adj = Number(src.contractualAdjustmentAmount ?? 0);
  const pr = Number(src.patientResponsibilityAmount ?? 0);

  if (paid < 0) {
    blocking.push({
      severity: "blocking",
      code: "negative_insurance_payment",
      field: "payerPaymentAmount",
      message: `Insurance payment cannot be negative (${paid.toFixed(2)}). Use reversal/recoupment in PP-4.`,
    });
  }
  if (adj < 0) {
    blocking.push({
      severity: "blocking",
      code: "negative_adjustment",
      field: "contractualAdjustmentAmount",
      message: `Contractual adjustment cannot be negative.`,
    });
  }
  if (pr < 0) {
    blocking.push({
      severity: "blocking",
      code: "negative_patient_responsibility",
      field: "patientResponsibilityAmount",
      message: `Patient responsibility cannot be negative.`,
    });
  }
  if (paid === 0 && adj === 0 && pr === 0) {
    blocking.push({
      severity: "blocking",
      code: "zero_total",
      field: "payerPaymentAmount",
      message: "At least one of payment / adjustment / patient responsibility must be greater than zero.",
    });
  }

  const explicitCharge = src.totalChargeAmount != null ? Number(src.totalChargeAmount) : null;
  const dbCharge = claim.total_charge_amount != null ? Number(claim.total_charge_amount) : null;
  const charge = explicitCharge ?? dbCharge ?? round2(paid + adj + pr);
  const expected = round2(paid + adj + pr);
  const variance = round2(expected - charge);

  if (charge > 0 && Math.abs(variance) > POSTING_BALANCE_TOLERANCE * 2) {
    blocking.push({
      severity: "blocking",
      code: "balance_mismatch",
      field: "totalChargeAmount",
      message: `Posting does not balance: payment ${paid.toFixed(2)} + adjustment ${adj.toFixed(2)} + patient ${pr.toFixed(2)} = ${expected.toFixed(2)}, but charge is ${charge.toFixed(2)} (variance ${variance.toFixed(2)}).`,
    });
  } else if (charge > 0 && Math.abs(variance) > POSTING_BALANCE_TOLERANCE) {
    warning.push({
      severity: "warning",
      code: "balance_rounding",
      field: "totalChargeAmount",
      message: `Posting has minor rounding variance of ${variance.toFixed(4)}; auto-rounding to the nearest cent.`,
    });
  }

  if (pr > 0 && !claim.patient_id) {
    warning.push({
      severity: "warning",
      code: "patient_resp_without_client",
      field: "clientId",
      message: "Patient responsibility was entered but the claim is not linked to a patient; no invoice will be created.",
    });
  }

  if (paid === 0 && adj > 0 && pr === 0) {
    warning.push({
      severity: "warning",
      code: "likely_denial",
      field: "payerPaymentAmount",
      message: "Zero payment with non-zero adjustment and no patient responsibility — this looks like a denial.",
    });
  }

  return { blocking, warning };
}

function emptyResult(): CommitPostingResult {
  return {
    ok: false,
    posted: false,
    blocked: false,
    alreadyPosted: false,
    validation: { blocking: [], warning: [] },
    effects: [],
    patientInvoiceCreated: false,
    workqueueItemsClosed: 0,
    auditLogIds: [],
    errors: [],
  };
}

export async function commitManualInsurancePosting(
  organizationId: string,
  src: ManualInsuranceSource,
  actor: PostingActor,
  dryRun?: boolean,
): Promise<CommitPostingResult> {
  const result = emptyResult();
  const supabase = createServerSupabaseAdminClient();
  if (!supabase) {
    result.errors.push({ field: "system", message: "Database connection not available" });
    return result;
  }

  const { data: claim, error: claimError } = await supabase
    .from("professional_claims")
    .select("id, organization_id, patient_id, total_charge_amount, payer_responsibility_amount, patient_responsibility_amount, claim_status")
    .eq("organization_id", organizationId)
    .eq("id", src.professionalClaimId)
    .is("archived_at", null)
    .maybeSingle();

  if (claimError) {
    result.errors.push({ field: "professional_claims", message: claimError.message });
    return result;
  }

  const hydrated = (claim as ManualInsuranceHydratedClaim | null);
  result.validation = validateManualInsurancePosting(src, hydrated);

  if (result.validation.blocking.length > 0) {
    result.blocked = true;
    result.errors.push(...result.validation.blocking.map((i) => ({ field: i.field, message: i.message })));
    return result;
  }

  if (dryRun) {
    result.ok = true;
    return result;
  }

  const now = new Date().toISOString();
  const paid = round2(Number(src.payerPaymentAmount ?? 0));
  const adj = round2(Number(src.contractualAdjustmentAmount ?? 0));
  const pr = round2(Number(src.patientResponsibilityAmount ?? 0));
  const clientId = src.clientId ?? hydrated!.patient_id ?? null;
  const manualId = genId();

  const { error: insertError } = await supabase
    .from("insurance_manual_payments")
    .insert({
      id: manualId,
      organization_id: organizationId,
      claim_id: hydrated!.id,
      client_id: clientId,
      eob_reference: src.eobReference ?? null,
      allowed_amount: round2(paid + adj),
      paid_amount: paid,
      adjustment_amount: adj,
      patient_responsibility_amount: pr,
      payer_profile_id: src.payerProfileId ?? null,
      check_number: src.checkOrEftNumber ?? null,
      payment_date: src.paymentDate,
      mailroom_item_id: src.mailroomItemId ?? null,
      posted_actor_id: actor.staffId ?? null,
      posting_status: "posted",
      note: src.note ?? null,
      posted_at: now,
      created_at: now,
      updated_at: now,
    });

  if (insertError) {
    result.errors.push({ field: "insurance_manual_payments", message: insertError.message });
    return result;
  }

  try {
    if (paid > 0) {
      await writeLedger(supabase, organizationId, manualId, hydrated!, clientId, {
        entryType: "insurance_payment",
        amount: paid,
        description: `Manual insurance payment posted (EOB ${src.eobReference ?? "—"})`,
      });
      result.effects.push({ entryType: "insurance_payment", amount: paid, description: "Manual insurance payment" });
    }
    if (adj > 0) {
      await writeLedger(supabase, organizationId, manualId, hydrated!, clientId, {
        entryType: "contractual_adjustment",
        amount: adj,
        groupCode: "CO",
        description: "Contractual adjustment from manual EOB",
      });
      result.effects.push({ entryType: "contractual_adjustment", amount: adj, groupCode: "CO", description: "Contractual adjustment" });
    }
    if (pr > 0) {
      await writeLedger(supabase, organizationId, manualId, hydrated!, clientId, {
        entryType: "patient_responsibility",
        amount: pr,
        groupCode: "PR",
        description: "Patient responsibility from manual EOB",
      });
      result.effects.push({ entryType: "patient_responsibility", amount: pr, groupCode: "PR", description: "Patient responsibility" });

      if (clientId) {
        const created = await createPatientInvoiceForManual(supabase, organizationId, hydrated!, clientId, manualId, pr, actor, result.auditLogIds);
        result.patientInvoiceCreated = created;
      }
    }

    const newClaimStatus = paid > 0 || pr > 0 ? "paid" : "denied";
    const claimPatch: Record<string, unknown> = { claim_status: newClaimStatus, updated_at: now };
    const { error: updErr } = await supabase
      .from("professional_claims")
      .update(claimPatch)
      .eq("id", hydrated!.id)
      .eq("organization_id", organizationId);
    if (updErr) throw new Error(updErr.message);

    const audit = await writePaymentAuditLog(supabase, {
      organizationId,
      actor,
      action: "payment_posted",
      objectType: "payment_adjustment",
      objectId: manualId,
      claimId: hydrated!.id,
      beforeValue: { posting_status: "pending" },
      afterValue: {
        posting_status: "posted",
        claim_status: newClaimStatus,
        insurance_payment: paid,
        contractual_adjustment: adj,
        patient_responsibility: pr,
        source: "manual_insurance",
        check_number: src.checkOrEftNumber ?? null,
        eob_reference: src.eobReference ?? null,
        mailroom_item_id: src.mailroomItemId ?? null,
      },
      summary: `Posted manual insurance payment ${paid.toFixed(2)} on claim ${hydrated!.id}`,
      metadata: { source: "manual_insurance", warnings: result.validation.warning.map((w) => w.code) },
    });
    if (audit) result.auditLogIds.push(audit.id);

    result.ok = true;
    result.posted = true;
    return result;
  } catch (err) {
    result.errors.push({
      field: hydrated!.id,
      message: err instanceof Error ? err.message : "Failed to post manual insurance payment",
    });
    return result;
  }
}

async function writeLedger(
  supabase: NonNullable<ReturnType<typeof createServerSupabaseAdminClient>>,
  organizationId: string,
  sourceId: string,
  claim: ManualInsuranceHydratedClaim,
  clientId: string | null,
  effect: {
    entryType: "insurance_payment" | "contractual_adjustment" | "patient_responsibility";
    amount: number;
    groupCode?: string;
    description: string;
  },
) {
  const { error } = await supabase.from("era_posting_ledger_entries").insert({
    organization_id: organizationId,
    era_claim_payment_id: null,
    professional_claim_id: claim.id,
    client_id: clientId,
    source_type: "manual_insurance",
    source_id: sourceId,
    entry_type: effect.entryType,
    amount: effect.amount,
    group_code: effect.groupCode ?? null,
    description: effect.description,
  });
  if (error) throw new Error(error.message);
}

async function createPatientInvoiceForManual(
  supabase: NonNullable<ReturnType<typeof createServerSupabaseAdminClient>>,
  organizationId: string,
  claim: ManualInsuranceHydratedClaim,
  clientId: string,
  manualPaymentId: string,
  amount: number,
  actor: PostingActor,
  auditSink: string[],
): Promise<boolean> {
  const { data, error } = await supabase
    .from("patient_invoices")
    .insert({
      organization_id: organizationId,
      client_id: clientId,
      professional_claim_id: claim.id,
      invoice_status: "open",
      invoice_number: invoiceNumber(manualPaymentId),
      patient_responsibility_amount: amount,
      paid_amount: 0,
      balance_amount: amount,
      source: "manual_pr",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  if (!data) return false;
  const audit = await writePaymentAuditLog(supabase, {
    organizationId,
    actor,
    action: "patient_invoice_created",
    objectType: "patient_invoice",
    objectId: String((data as { id: string }).id),
    claimId: claim.id,
    afterValue: { patient_responsibility_amount: amount, source: "manual_pr" },
    summary: `Patient invoice ${invoiceNumber(manualPaymentId)} created from manual EOB PR balance ${amount.toFixed(2)}`,
  });
  if (audit) auditSink.push(audit.id);
  return true;
}
