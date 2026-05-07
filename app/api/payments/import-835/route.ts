// File: app/api/payments/import-835/route.ts
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServerSupabaseAdminClientTyped } from "@/lib/supabase/server";
import { parse835 } from "@/lib/clearinghouse/parsers/parse835";
import type { Json } from "@/lib/supabase/database.types";

function generateUuid() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function POST(request: Request) {
  try {
    const supabase = createServerSupabaseAdminClientTyped();

    if (!supabase) {
      return NextResponse.json({ success: false, error: "Database connection not available" }, { status: 500 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const submittedOrganizationId = String(formData.get("organizationId") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "835 file is required" }, { status: 400 });
    }

    let organizationId = submittedOrganizationId;

    if (!organizationId || !isUuid(organizationId)) {
      const { data: firstOrganization, error: orgLookupError } = await supabase
        .from("organizations")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (orgLookupError) throw orgLookupError;

      if (!firstOrganization?.id || typeof firstOrganization.id !== "string") {
        return NextResponse.json(
          { success: false, error: "Create an organization before importing 835 files." },
          { status: 400 },
        );
      }

      organizationId = firstOrganization.id;
    }

    const raw835 = await file.text();

    if (!raw835.includes("ISA") || !raw835.includes("CLP")) {
      return NextResponse.json({ success: false, error: "File does not appear to be a valid 835 ERA" }, { status: 422 });
    }

    const parsed = parse835(raw835);
    const now = new Date().toISOString();
    const fileHash = crypto.createHash("sha256").update(raw835).digest("hex");

    const batchId = generateUuid();

    const { error: batchError } = await supabase
      .from("payment_import_batches")
      .insert({
        id: batchId,
        organization_id: organizationId,
        import_source: "835_era_upload",
        payment_import_status: "parsed",
        source_file_name: file.name,
        source_file_hash: fileHash,
        imported_at: now,
        total_item_count: parsed.claims.length,
        total_amount: parsed.totalPaymentAmount ?? 0,
        parse_errors_count: 0,
        created_at: now,
        updated_at: now,
      });

    if (batchError) throw batchError;

    const importedItems: any[] = [];
    const unmatchedClaims: any[] = [];

    for (const claim of parsed.claims) {
      const patientControlNumber = claim.patientControlNumber;

      let matchedClaim: { id: string; client_id: string | null } | null = null;

      if (patientControlNumber) {
        const { data: claimNumberMatch } = await supabase
          .from("claims")
          .select("id, client_id")
          .eq("organization_id", organizationId)
          .eq("claim_number", patientControlNumber)
          .limit(1)
          .maybeSingle();

        matchedClaim = claimNumberMatch;
      }

      if (!matchedClaim && patientControlNumber && isUuid(patientControlNumber)) {
        const { data: idMatch } = await supabase
          .from("claims")
          .select("id, client_id")
          .eq("organization_id", organizationId)
          .eq("id", patientControlNumber)
          .limit(1)
          .maybeSingle();

        matchedClaim = idMatch;
      }

      const itemId = generateUuid();

      const payload = {
        payer_name: claim.payerName,
        payee_name: claim.payeeName,
        claim_status_code: claim.claimStatusCode,
        check_or_eft_number: claim.checkOrEftNumber,
        trace_number: claim.traceNumber,
        adjustments: claim.adjustments,
        service_lines: claim.serviceLines,
        raw_claim_payload: claim.raw,
      } as unknown as Json;

      const itemRecord = {
        id: itemId,
        organization_id: organizationId,
        batch_id: batchId,
        payment_import_status: matchedClaim ? "matched" : "unmatched",
        imported_item_ref: patientControlNumber,
        payment_date: claim.paymentDate,
        payer_id: null,
        claim_id: matchedClaim?.id ?? null,
        client_id: matchedClaim?.client_id ?? null,
        service_line_ref: null,
        gross_amount: claim.totalChargeAmount ?? 0,
        adjustment_amount:
          claim.adjustments.reduce((sum, adj) => sum + Number(adj.amount ?? 0), 0),
        net_amount: claim.paidAmount ?? 0,
        unapplied_amount: matchedClaim ? 0 : claim.paidAmount ?? 0,
        posting_ready: Boolean(matchedClaim),
        raw_item_payload: payload,
        original_file_name: file.name,
        storage_bucket: null,
        storage_path: null,
        file_hash: fileHash,
        parse_status: "parsed",
        parse_error: null,
        parsed_at: now,
        match_status: matchedClaim ? "matched" : "unmatched",
        match_reason: matchedClaim
          ? "Matched by claim number or claim id"
          : "No claim matched from ERA import",
        matched_at: matchedClaim ? now : null,
        created_at: now,
        updated_at: now,
      };

      const { error: itemError } = await supabase
        .from("payment_import_items")
        .insert(itemRecord);

      if (itemError) throw itemError;

      importedItems.push(itemRecord);

      if (!matchedClaim) {
        unmatchedClaims.push({
          imported_item_ref: patientControlNumber,
          payer_name: claim.payerName,
          paid_amount: claim.paidAmount,
        });
      }
    }

    return NextResponse.json({
      success: true,
      batchId,
      fileName: file.name,
      summary: {
        claimsFound: parsed.claims.length,
        matchedClaims: importedItems.filter((x) => x.claim_id).length,
        unmatchedClaims: unmatchedClaims.length,
        postingReady: importedItems.filter((x) => x.posting_ready).length,
        totalPaymentAmount: parsed.totalPaymentAmount,
        payerName: parsed.payerName,
        paymentDate: parsed.paymentDate,
      },
      unmatchedClaims,
    });
  } catch (error) {
    console.error("835 import failed", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "835 import failed",
      },
      { status: 500 },
    );
  }
}
