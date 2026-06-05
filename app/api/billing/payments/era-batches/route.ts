import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;
const text = (value: unknown) => String(value ?? "").trim();
const money = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

function patientName(row: Row) {
  return text(row.parsed_patient_name) || [row.parsed_patient_first_name, row.parsed_patient_middle_name, row.parsed_patient_last_name].map(text).filter(Boolean).join(" ") || null;
}

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Database connection not available" }, { status: 500 });
    const { searchParams } = new URL(request.url);
    const organizationId = text(searchParams.get("organizationId"));
    const batchId = text(searchParams.get("batchId") ?? searchParams.get("eraImportBatchId"));
    if (!organizationId) return NextResponse.json({ success: false, error: "organizationId is required" }, { status: 400 });

    let batchQuery = supabase
      .from("era_import_batches")
      .select("id, source, file_name, import_status, total_claims, total_payment_amount, total_patient_responsibility, imported_at, created_at, updated_at")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("imported_at", { ascending: false })
      .limit(batchId ? 1 : 50);
    if (batchId) batchQuery = batchQuery.eq("id", batchId);
    const { data: batches, error: batchError } = await batchQuery;
    if (batchError) throw batchError;

    const batchIds = ((batches ?? []) as Row[]).map((batch) => text(batch.id)).filter(Boolean);
    const { data: payments, error: paymentError } = batchIds.length
      ? await supabase
          .from("era_claim_payments")
          .select("id, era_import_batch_id, professional_claim_id, client_id, parsed_patient_name, parsed_patient_first_name, parsed_patient_middle_name, parsed_patient_last_name, parsed_patient_member_id, parsed_patient_date_of_birth, clp01_claim_control_number, clp02_claim_status_code, clp03_total_charge, clp04_payment_amount, clp05_patient_responsibility, payer_claim_control_number, claim_match_status, posting_status, match_blockers, service_lines, cas_adjustments, posted_at, created_at, updated_at")
          .eq("organization_id", organizationId)
          .in("era_import_batch_id", batchIds)
          .is("archived_at", null)
          .order("created_at", { ascending: true })
      : { data: [] as Row[], error: null };
    if (paymentError) throw paymentError;

    const paymentsByBatch = new Map<string, Row[]>();
    for (const payment of (payments ?? []) as Row[]) {
      const id = text(payment.era_import_batch_id);
      paymentsByBatch.set(id, [...(paymentsByBatch.get(id) ?? []), payment]);
    }

    return NextResponse.json({
      success: true,
      batches: ((batches ?? []) as Row[]).map((batch) => ({
        id: text(batch.id),
        source: batch.source,
        fileName: batch.file_name,
        status: batch.import_status,
        totalClaims: Number(batch.total_claims ?? 0),
        totalPaymentAmount: money(batch.total_payment_amount),
        totalPatientResponsibility: money(batch.total_patient_responsibility),
        importedAt: batch.imported_at,
        payments: (paymentsByBatch.get(text(batch.id)) ?? []).map((payment) => ({
          id: text(payment.id),
          professionalClaimId: payment.professional_claim_id ?? null,
          clientId: payment.client_id ?? null,
          parsedPatientName: patientName(payment),
          parsedPatientFirstName: payment.parsed_patient_first_name ?? null,
          parsedPatientMiddleName: payment.parsed_patient_middle_name ?? null,
          parsedPatientLastName: payment.parsed_patient_last_name ?? null,
          parsedPatientMemberId: payment.parsed_patient_member_id ?? null,
          parsedPatientDateOfBirth: payment.parsed_patient_date_of_birth ?? null,
          claimControlNumber: payment.clp01_claim_control_number,
          payerClaimControlNumber: payment.payer_claim_control_number,
          claimStatusCode: payment.clp02_claim_status_code,
          totalCharge: money(payment.clp03_total_charge),
          paymentAmount: money(payment.clp04_payment_amount),
          patientResponsibility: money(payment.clp05_patient_responsibility),
          claimMatchStatus: payment.claim_match_status,
          postingStatus: payment.posting_status,
          matchBlockers: payment.match_blockers ?? [],
          serviceLines: payment.service_lines ?? [],
          adjustments: payment.cas_adjustments ?? [],
          postedAt: payment.posted_at ?? null,
        })),
      })),
    });
  } catch (error) {
    console.error("ERA batches API error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "ERA batches failed" }, { status: 500 });
  }
}
