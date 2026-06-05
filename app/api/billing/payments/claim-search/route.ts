import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

type Row = Record<string, unknown>;

function text(value: unknown) {
  return String(value ?? "").trim();
}

function money(value: unknown) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function dateOnly(value: unknown) {
  return text(value).slice(0, 10);
}

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

    const rawQuery = text(searchParams.get("q") ?? searchParams.get("query") ?? searchParams.get("search") ?? searchParams.get("term")).toLowerCase();
    const clientId = text(searchParams.get("clientId") ?? searchParams.get("patientId"));
    const claimId = text(searchParams.get("claimId") ?? searchParams.get("professionalClaimId"));
    const payerId = text(searchParams.get("payerId") ?? searchParams.get("payerProfileId"));
    const dos = dateOnly(searchParams.get("dos") ?? searchParams.get("serviceDate") ?? searchParams.get("dateOfService"));
    const cpt = text(searchParams.get("cpt") ?? searchParams.get("procedureCode") ?? searchParams.get("hcpcs")).toLowerCase();
    const batchId = text(searchParams.get("batchId") ?? searchParams.get("claimBatchId") ?? searchParams.get("ediBatchId"));
    const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 25), 1), 100);

    let claimIdsFromBatch: string[] | null = null;
    if (batchId) {
      const { data: canonicalLinks, error: canonicalError } = await supabase
        .from("claim_837p_batch_claims")
        .select("professional_claim_id")
        .eq("organization_id", organizationId)
        .eq("batch_id", batchId)
        .is("archived_at", null);
      if (canonicalError) throw canonicalError;

      const { data: ediLinks } = await supabase.from("edi_batch_claims").select("claim_id").eq("edi_batch_id", batchId);
      claimIdsFromBatch = [
        ...((canonicalLinks ?? []) as Row[]).map((row) => text(row.professional_claim_id)),
        ...((ediLinks ?? []) as Row[]).map((row) => text(row.claim_id)),
      ].filter(Boolean);

      if (claimIdsFromBatch.length === 0) {
        return NextResponse.json({ success: true, claims: [], count: 0, filters: { organizationId, batchId } });
      }
    }

    let query = supabase
      .from("professional_claims")
      .select("id, organization_id, client_id, patient_id, payer_profile_id, appointment_id, encounter_id, claim_number, patient_account_number, claim_status, total_charge, place_of_service, diagnosis_codes, submitted_at, created_at, updated_at")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .order("updated_at", { ascending: false })
      .limit(500);

    if (clientId) query = query.or(`client_id.eq.${clientId},patient_id.eq.${clientId}`);
    if (claimId) query = query.eq("id", claimId);
    if (payerId) query = query.eq("payer_profile_id", payerId);
    if (claimIdsFromBatch?.length) query = query.in("id", claimIdsFromBatch);

    const { data: claimRows, error: claimError } = await query;
    if (claimError) throw claimError;

    const claimIds = ((claimRows ?? []) as Row[]).map((claim) => text(claim.id)).filter(Boolean);
    const clientIds = [...new Set(((claimRows ?? []) as Row[]).flatMap((claim) => [text(claim.client_id), text(claim.patient_id)]).filter(Boolean))];
    const payerIds = [...new Set(((claimRows ?? []) as Row[]).map((claim) => text(claim.payer_profile_id)).filter(Boolean))];

    const { data: lines } = claimIds.length
      ? await supabase
          .from("professional_claim_service_lines")
          .select("id, claim_id, line_number, service_date_from, service_date_to, procedure_code, charge_amount, units, place_of_service")
          .in("claim_id", claimIds)
      : { data: [] as Row[] };

    const { data: clients } = clientIds.length
      ? await supabase.from("clients").select("id, first_name, last_name, date_of_birth").eq("organization_id", organizationId).in("id", clientIds)
      : { data: [] as Row[] };

    const { data: payers } = payerIds.length
      ? await supabase.from("payer_profiles").select("id, payer_name, office_ally_payer_id").eq("organization_id", organizationId).in("id", payerIds)
      : { data: [] as Row[] };

    const linesByClaim = new Map<string, Row[]>();
    for (const line of (lines ?? []) as Row[]) {
      const id = text(line.claim_id);
      linesByClaim.set(id, [...(linesByClaim.get(id) ?? []), line]);
    }
    const clientsById = new Map(((clients ?? []) as Row[]).map((client) => [text(client.id), client]));
    const payersById = new Map(((payers ?? []) as Row[]).map((payer) => [text(payer.id), payer]));

    const records = ((claimRows ?? []) as Row[])
      .map((claim) => {
        const id = text(claim.id);
        const claimLines = linesByClaim.get(id) ?? [];
        const resolvedClientId = text(claim.client_id) || text(claim.patient_id);
        const patient = clientsById.get(resolvedClientId);
        const payer = payersById.get(text(claim.payer_profile_id));
        return {
          id,
          claimId: id,
          claimNumber: claim.claim_number ?? null,
          patientAccountNumber: claim.patient_account_number ?? null,
          status: claim.claim_status ?? null,
          clientId: resolvedClientId || null,
          patientId: resolvedClientId || null,
          patientName: nameOf(patient),
          patientDateOfBirth: patient?.date_of_birth ?? null,
          payerProfileId: claim.payer_profile_id ?? null,
          payerName: payer?.payer_name ?? null,
          payerId: payer?.office_ally_payer_id ?? null,
          totalCharge: money(claim.total_charge),
          serviceDates: [...new Set(claimLines.map((line) => dateOnly(line.service_date_from)).filter(Boolean))],
          procedureCodes: [...new Set(claimLines.map((line) => text(line.procedure_code)).filter(Boolean))],
          serviceLines: claimLines.map((line) => ({
            id: text(line.id),
            lineNumber: line.line_number,
            serviceDateFrom: line.service_date_from,
            serviceDateTo: line.service_date_to,
            procedureCode: line.procedure_code,
            chargeAmount: money(line.charge_amount),
            units: Number(line.units ?? 0),
            placeOfService: line.place_of_service ?? claim.place_of_service ?? null,
          })),
          submittedAt: claim.submitted_at ?? null,
          createdAt: claim.created_at ?? null,
          updatedAt: claim.updated_at ?? null,
        };
      })
      .filter((claim) => {
        if (dos && !claim.serviceDates.includes(dos)) return false;
        if (cpt && !claim.procedureCodes.some((code) => code.toLowerCase().includes(cpt))) return false;
        if (!rawQuery) return true;
        return [
          claim.id,
          claim.claimNumber,
          claim.patientAccountNumber,
          claim.patientName,
          claim.payerName,
          claim.payerId,
          claim.status,
          ...claim.serviceDates,
          ...claim.procedureCodes,
        ]
          .map((value) => text(value).toLowerCase())
          .some((value) => value.includes(rawQuery));
      })
      .slice(0, limit);

    return NextResponse.json({ success: true, claims: records, count: records.length, filters: { organizationId, q: rawQuery, clientId, claimId, payerId, dos, cpt, batchId } });
  } catch (error) {
    console.error("Billing payment claim-search API error:", error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Claim search failed" }, { status: 500 });
  }
}
