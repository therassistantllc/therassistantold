import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;
const text = (value: unknown) => String(value ?? "").trim();
const money = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
};

function nameOf(row: Row | undefined) {
  if (!row) return "Unassigned patient";
  return [row.first_name, row.last_name].map(text).filter(Boolean).join(" ") || "Unnamed patient";
}

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Database connection not available" }, { status: 500 });
    const { searchParams } = new URL(request.url);
    const organizationId = text(searchParams.get("organizationId"));
    if (!organizationId) return NextResponse.json({ success: false, error: "organizationId is required" }, { status: 400 });
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 100), 1), 250);

    const { data: posted, error } = await supabase
      .from("rcm_posted_payments")
      .select("id, client_id, professional_claim_id, era_claim_payment_id, patient_invoice_id, payment_type, amount, description, posted_at, source_table")
      .eq("organization_id", organizationId)
      .order("posted_at", { ascending: false })
      .limit(limit);
    if (error) throw error;

    const clientIds = [...new Set(((posted ?? []) as Row[]).map((row) => text(row.client_id)).filter(Boolean))];
    const claimIds = [...new Set(((posted ?? []) as Row[]).map((row) => text(row.professional_claim_id)).filter(Boolean))];
    const { data: clients } = clientIds.length
      ? await supabase.from("clients").select("id, first_name, last_name").eq("organization_id", organizationId).in("id", clientIds)
      : { data: [] as Row[] };
    const { data: claims } = claimIds.length
      ? await supabase.from("professional_claims").select("id, claim_number, patient_account_number, claim_status").eq("organization_id", organizationId).in("id", claimIds)
      : { data: [] as Row[] };

    const clientsById = new Map(((clients ?? []) as Row[]).map((client) => [text(client.id), client]));
    const claimsById = new Map(((claims ?? []) as Row[]).map((claim) => [text(claim.id), claim]));
    const payments = ((posted ?? []) as Row[]).map((row) => {
      const claim = claimsById.get(text(row.professional_claim_id));
      return {
        id: text(row.id),
        type: row.payment_type,
        amount: money(row.amount),
        description: row.description ?? null,
        postedAt: row.posted_at,
        sourceTable: row.source_table,
        clientId: row.client_id ?? null,
        patientName: nameOf(clientsById.get(text(row.client_id))),
        professionalClaimId: row.professional_claim_id ?? null,
        claimNumber: claim?.claim_number ?? claim?.patient_account_number ?? null,
        claimStatus: claim?.claim_status ?? null,
        eraClaimPaymentId: row.era_claim_payment_id ?? null,
        patientInvoiceId: row.patient_invoice_id ?? null,
      };
    });

    return NextResponse.json({
      success: true,
      payments,
      count: payments.length,
      totals: {
        insurancePayments: money(payments.filter((p) => p.type === "insurance_payment").reduce((sum, p) => sum + p.amount, 0)),
        contractualAdjustments: money(payments.filter((p) => p.type === "contractual_adjustment").reduce((sum, p) => sum + p.amount, 0)),
        patientResponsibilityTransfers: money(payments.filter((p) => p.type === "patient_responsibility").reduce((sum, p) => sum + p.amount, 0)),
        patientPayments: money(payments.filter((p) => p.type === "patient_payment").reduce((sum, p) => sum + p.amount, 0)),
      },
    });
  } catch (error) {
    console.error("Posted payments API error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Posted payments failed" }, { status: 500 });
  }
}
