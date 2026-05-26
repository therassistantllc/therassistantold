/**
 * POST /api/billing/era-batches/[id]/auto-match
 *
 * Runs the assisted matching engine over every unmatched era_claim_payment
 * in the batch. Auto-binds when an exact (confidence == 1) match is found;
 * otherwise leaves the payment unmatched and returns the candidate list so
 * the UI can prompt the biller to pick.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import {
  findCandidatesForEraClaimPayment,
  type MatchCandidate,
} from "@/lib/payments/assistedMatchingService";
import {
  PaymentPostingForbiddenError,
  PaymentPostingUnauthenticatedError,
  requireAuthenticatedPaymentPoster,
} from "@/lib/payments/postingEngine";

type ClaimPaymentRow = {
  id: string;
  clp01_claim_control_number: string;
  payer_claim_control_number: string | null;
  clp03_total_charge: number | string;
  claim_match_status: string;
  service_lines: unknown;
  era_import_batch_id: string;
};

type BatchRow = {
  id: string;
  parsed_summary: Record<string, unknown> | null;
};

function n(v: unknown): number {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
}

function firstServiceDate(serviceLines: unknown): string | null {
  if (!Array.isArray(serviceLines)) return null;
  for (const line of serviceLines as Array<Record<string, unknown>>) {
    const v = line?.serviceDate ?? line?.service_date;
    if (typeof v === "string" && /^\d{8}$/.test(v)) {
      return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
    }
    if (typeof v === "string" && v) return v;
  }
  return null;
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = (await request.json().catch(() => ({}))) as { organizationId?: string };
    const organizationId = body.organizationId ? String(body.organizationId) : "";
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "organizationId is required" }, { status: 400 });
    }
    await requireAuthenticatedPaymentPoster(organizationId);

    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Database connection not available" }, { status: 500 });
    }

    const { data: batch } = await supabase
      .from("era_import_batches")
      .select("id, parsed_summary")
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle();
    if (!batch) {
      return NextResponse.json({ success: false, error: "Batch not found" }, { status: 404 });
    }
    const batchRow = batch as BatchRow;
    const payerProfileId =
      batchRow.parsed_summary && typeof batchRow.parsed_summary === "object"
        ? (((batchRow.parsed_summary as Record<string, unknown>).payerProfileId as string) ?? null)
        : null;

    const { data: payments } = await supabase
      .from("era_claim_payments")
      .select(
        "id, clp01_claim_control_number, payer_claim_control_number, clp03_total_charge, claim_match_status, service_lines, era_import_batch_id",
      )
      .eq("organization_id", organizationId)
      .eq("era_import_batch_id", id)
      .neq("claim_match_status", "matched")
      .is("archived_at", null);
    const rows = (payments ?? []) as ClaimPaymentRow[];

    let bound = 0;
    const results: Array<{
      eraClaimPaymentId: string;
      bound: boolean;
      strategy: string | null;
      confidence: number;
      candidates: MatchCandidate[];
    }> = [];

    for (const row of rows) {
      const serviceDate = firstServiceDate(row.service_lines);
      const { exact, probable } = await findCandidatesForEraClaimPayment({
        organizationId,
        eraClaimPaymentId: row.id,
        clp01ClaimControlNumber: row.clp01_claim_control_number,
        payerClaimControlNumber: row.payer_claim_control_number,
        totalCharge: n(row.clp03_total_charge),
        payerProfileId,
        serviceDateFrom: serviceDate,
        serviceDateTo: serviceDate,
        patientLastName: null,
      });

      if (exact && exact.confidence >= 0.95) {
        const { error: updErr } = await supabase
          .from("era_claim_payments")
          .update({
            professional_claim_id: exact.professionalClaimId,
            client_id: exact.clientId,
            claim_match_status: "matched",
            posting_status: "ready",
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .eq("organization_id", organizationId);
        if (!updErr) {
          bound += 1;
          results.push({
            eraClaimPaymentId: row.id,
            bound: true,
            strategy: exact.strategy,
            confidence: exact.confidence,
            candidates: [exact],
          });
          continue;
        }
      }
      results.push({
        eraClaimPaymentId: row.id,
        bound: false,
        strategy: null,
        confidence: 0,
        candidates: probable,
      });
    }

    return NextResponse.json({ success: true, processed: rows.length, bound, results });
  } catch (error) {
    if (error instanceof PaymentPostingUnauthenticatedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof PaymentPostingForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error("ERA batch auto-match error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Auto-match failed" },
      { status: 500 },
    );
  }
}
