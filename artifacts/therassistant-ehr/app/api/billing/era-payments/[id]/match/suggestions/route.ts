/**
 * GET /api/billing/era-payments/[id]/match/suggestions?organizationId=…
 *
 * Returns probable claim-match candidates for the given ERA claim payment
 * via the assisted matching engine. Used by the "match claim →" prompt in
 * the poster workspace to show ranked candidates instead of a blank box.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { findCandidatesForEraClaimPayment } from "@/lib/payments/assistedMatchingService";
import {
  PaymentPostingForbiddenError,
  PaymentPostingUnauthenticatedError,
  requireAuthenticatedPaymentPoster,
} from "@/lib/payments/postingEngine";

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

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Database connection not available" }, { status: 500 });
    }
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "organizationId is required" }, { status: 400 });
    }
    await requireAuthenticatedPaymentPoster(organizationId);

    const { data: payment } = await supabase
      .from("era_claim_payments")
      .select(
        "id, era_import_batch_id, clp01_claim_control_number, payer_claim_control_number, clp03_total_charge, service_lines",
      )
      .eq("organization_id", organizationId)
      .eq("id", id)
      .maybeSingle();
    if (!payment) {
      return NextResponse.json({ success: false, error: "ERA claim payment not found" }, { status: 404 });
    }

    const { data: batch } = await supabase
      .from("era_import_batches")
      .select("parsed_summary")
      .eq("organization_id", organizationId)
      .eq("id", payment.era_import_batch_id)
      .maybeSingle();
    const payerProfileId =
      batch?.parsed_summary && typeof batch.parsed_summary === "object"
        ? (((batch.parsed_summary as Record<string, unknown>).payerProfileId as string) ?? null)
        : null;

    const serviceDate = firstServiceDate(payment.service_lines);

    const result = await findCandidatesForEraClaimPayment({
      organizationId,
      eraClaimPaymentId: payment.id,
      clp01ClaimControlNumber: payment.clp01_claim_control_number,
      payerClaimControlNumber: payment.payer_claim_control_number,
      totalCharge: n(payment.clp03_total_charge),
      payerProfileId,
      serviceDateFrom: serviceDate,
      serviceDateTo: serviceDate,
      patientLastName: null,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof PaymentPostingUnauthenticatedError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof PaymentPostingForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Match suggestions failed" },
      { status: 500 },
    );
  }
}
