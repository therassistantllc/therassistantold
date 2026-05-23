/**
 * GET  /api/billing/clients/[clientId]/credits  — list unapplied credits.
 * POST /api/billing/clients/[clientId]/credits  — apply a credit to an
 *      invoice or claim.
 */

import { NextResponse } from "next/server";
import {
  applyClientCredit,
  requireAuthenticatedPaymentPoster,
  PaymentPostingForbiddenError,
  PaymentPostingUnauthenticatedError,
} from "@/lib/payments/postingEngine";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";
import { assertFkBelongsToOrg, FkOwnershipError } from "@/lib/payments/fkOwnershipGuard";

export async function GET(request: Request, { params }: { params: { clientId: string } }) {
  try {
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId") ?? "";
    if (!organizationId) {
      return NextResponse.json({ ok: false, error: "organizationId is required" }, { status: 400 });
    }
    await requireAuthenticatedPaymentPoster(organizationId);
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ ok: false, error: "DB unavailable" }, { status: 503 });

    const { data, error } = await supabase
      .from("client_credits")
      .select("id, client_id, source_payment_id, initial_amount, applied_amount, balance_amount, note, created_at")
      .eq("organization_id", organizationId)
      .eq("client_id", params.clientId)
      .is("archived_at", null)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 422 });
    return NextResponse.json({ ok: true, credits: data ?? [] });
  } catch (err) {
    if (err instanceof PaymentPostingUnauthenticatedError) return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    if (err instanceof PaymentPostingForbiddenError) return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: { clientId: string } }) {
  try {
    const body = await request.json();
    const organizationId = String(body.organizationId ?? "").trim();
    if (!organizationId) return NextResponse.json({ ok: false, error: "organizationId is required" }, { status: 400 });
    const actor = await requireAuthenticatedPaymentPoster(organizationId);
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ ok: false, error: "DB unavailable" }, { status: 503 });

    const clientCreditId = String(body.clientCreditId ?? "").trim();
    if (!clientCreditId) return NextResponse.json({ ok: false, error: "clientCreditId is required" }, { status: 400 });
    await assertFkBelongsToOrg(supabase as unknown as Parameters<typeof assertFkBelongsToOrg>[0], "client_credits", organizationId, clientCreditId);

    let applyTo: { kind: "invoice"; patientInvoiceId: string } | { kind: "claim"; professionalClaimId: string };
    if (body.patientInvoiceId) {
      await assertFkBelongsToOrg(supabase as unknown as Parameters<typeof assertFkBelongsToOrg>[0], "patient_invoices", organizationId, String(body.patientInvoiceId));
      applyTo = { kind: "invoice", patientInvoiceId: String(body.patientInvoiceId) };
    } else if (body.professionalClaimId) {
      await assertFkBelongsToOrg(supabase as unknown as Parameters<typeof assertFkBelongsToOrg>[0], "professional_claims", organizationId, String(body.professionalClaimId));
      applyTo = { kind: "claim", professionalClaimId: String(body.professionalClaimId) };
    } else {
      return NextResponse.json({ ok: false, error: "patientInvoiceId or professionalClaimId is required" }, { status: 400 });
    }

    void params.clientId;
    const r = await applyClientCredit({
      organizationId,
      clientCreditId,
      amount: Number(body.amount ?? 0),
      applyTo,
      actor,
      note: body.note ? String(body.note) : null,
    });
    if (!r.ok) return NextResponse.json({ ok: false, errors: r.errors }, { status: 422 });
    return NextResponse.json({ ok: true, applicationId: r.applicationId, newCreditBalance: r.newCreditBalance });
  } catch (err) {
    if (err instanceof PaymentPostingUnauthenticatedError) return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    if (err instanceof PaymentPostingForbiddenError) return NextResponse.json({ ok: false, error: err.message }, { status: 403 });
    if (err instanceof FkOwnershipError) return NextResponse.json({ ok: false, error: err.message }, { status: 404 });
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
