import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;
const text = (value: unknown) => String(value ?? "").trim();

function serviceLineBlockers(lines: unknown) {
  const blockers: Array<{ field: string; message: string }> = [];
  const serviceLines = Array.isArray(lines) ? (lines as Array<Record<string, unknown>>) : [];
  if (!serviceLines.length) blockers.push({ field: "service_line", message: "ERA payment has no service lines" });
  for (const [index, line] of serviceLines.entries()) {
    if (!text(line.procedureCode)) blockers.push({ field: `service_lines[${index}].procedureCode`, message: "Service line is missing CPT/HCPCS" });
    if (!text(line.serviceDate)) blockers.push({ field: `service_lines[${index}].serviceDate`, message: "Service line is missing DOS" });
  }
  return blockers;
}

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) return NextResponse.json({ success: false, error: "Database connection not available" }, { status: 500 });
    const body = await request.json();
    const organizationId = text(body.organizationId);
    const eraClaimPaymentId = text(body.eraClaimPaymentId ?? body.eraPaymentId);
    const clientId = text(body.clientId ?? body.patientId);
    const professionalClaimId = text(body.professionalClaimId ?? body.claimId);
    if (!organizationId || !eraClaimPaymentId) return NextResponse.json({ success: false, error: "organizationId and eraClaimPaymentId are required" }, { status: 400 });

    const { data: current, error: currentError } = await supabase
      .from("era_claim_payments")
      .select("id, service_lines, client_id, professional_claim_id")
      .eq("organization_id", organizationId)
      .eq("id", eraClaimPaymentId)
      .is("archived_at", null)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return NextResponse.json({ success: false, error: "ERA claim payment not found" }, { status: 404 });

    const nextClientId = clientId || text((current as Row).client_id);
    const nextClaimId = professionalClaimId || text((current as Row).professional_claim_id);
    const blockers = [
      ...(!nextClientId ? [{ field: "patient", message: "ERA payment is not linked to a patient" }] : []),
      ...(!nextClaimId ? [{ field: "claim", message: "ERA payment is not matched to a professional claim" }] : []),
      ...serviceLineBlockers((current as Row).service_lines),
    ];

    if (professionalClaimId) {
      const { data: claim, error: claimError } = await supabase
        .from("professional_claims")
        .select("id, client_id, patient_id")
        .eq("organization_id", organizationId)
        .eq("id", professionalClaimId)
        .is("archived_at", null)
        .maybeSingle();
      if (claimError) throw claimError;
      if (!claim) return NextResponse.json({ success: false, error: "Professional claim not found" }, { status: 404 });
    }

    const update = {
      client_id: nextClientId || null,
      professional_claim_id: nextClaimId || null,
      claim_match_status: nextClaimId ? "matched" : "unmatched",
      posting_status: blockers.length ? "blocked" : "ready",
      match_blockers: blockers,
      updated_at: new Date().toISOString(),
    };

    const { data: updated, error: updateError } = await supabase
      .from("era_claim_payments")
      .update(update)
      .eq("organization_id", organizationId)
      .eq("id", eraClaimPaymentId)
      .select("id, professional_claim_id, client_id, claim_match_status, posting_status, match_blockers")
      .single();
    if (updateError) throw updateError;

    return NextResponse.json({ success: true, payment: updated, postable: blockers.length === 0, missing: blockers });
  } catch (error) {
    console.error("ERA match API error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "ERA match failed" }, { status: 500 });
  }
}
