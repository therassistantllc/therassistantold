/**
 * GET /api/billing/era-batches?organizationId=…
 *
 * Returns the ERA queue: one row per 835 import batch with aggregate counts
 * of matched / unmatched / blocked / posted / denial / recoupment children.
 *
 * Task #108 — primary feed for /billing/payments/era.
 */
import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

type ParsedSummary = Record<string, unknown> | null;

type BatchRow = {
  id: string;
  organization_id: string;
  source: string;
  file_name: string | null;
  import_status: string;
  total_claims: number;
  total_payment_amount: number | string;
  total_patient_responsibility: number | string;
  payer_identifier: string | null;
  payer_name: string | null;
  eft_or_check_number: string | null;
  payment_date: string | null;
  payment_method_code: string | null;
  imported_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  parsed_summary: ParsedSummary;
};

type ChildRow = {
  era_import_batch_id: string;
  claim_match_status: string;
  posting_status: string;
  clp02_claim_status_code: string | null;
  clp04_payment_amount: number | string;
};

function asNumber(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function readString(parsed: ParsedSummary, key: string): string | null {
  if (!parsed || typeof parsed !== "object") return null;
  const v = (parsed as Record<string, unknown>)[key];
  return typeof v === "string" ? v : null;
}

export async function GET(request: Request) {
  try {
    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Database connection not available" }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    if (!organizationId) {
      return NextResponse.json({ success: false, error: "organizationId is required" }, { status: 400 });
    }
    const includeArchivedParam = searchParams.get("includeArchived");
    const includeArchived = includeArchivedParam === "1" || includeArchivedParam === "true";

    let batchQuery = supabase
      .from("era_import_batches")
      .select(
        "id, organization_id, source, file_name, import_status, total_claims, total_payment_amount, total_patient_responsibility, payer_identifier, payer_name, eft_or_check_number, payment_date, payment_method_code, imported_at, created_at, updated_at, archived_at, parsed_summary",
      )
      .eq("organization_id", organizationId)
      .order("imported_at", { ascending: false })
      .limit(200);
    if (!includeArchived) {
      batchQuery = batchQuery.is("archived_at", null);
    }
    const { data: batches, error } = await batchQuery;

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const rows = (batches ?? []) as BatchRow[];
    const batchIds = rows.map((r) => r.id);

    const childMap = new Map<
      string,
      {
        total: number;
        matched: number;
        unmatched: number;
        blocked: number;
        posted: number;
        denied: number;
        recoupment: number;
        totalApplied: number;
      }
    >();
    if (batchIds.length > 0) {
      const { data: children } = await supabase
        .from("era_claim_payments")
        .select(
          "era_import_batch_id, claim_match_status, posting_status, clp02_claim_status_code, clp04_payment_amount",
        )
        .eq("organization_id", organizationId)
        .in("era_import_batch_id", batchIds)
        .is("archived_at", null);
      for (const child of (children ?? []) as ChildRow[]) {
        const bucket = childMap.get(child.era_import_batch_id) ?? {
          total: 0,
          matched: 0,
          unmatched: 0,
          blocked: 0,
          posted: 0,
          denied: 0,
          recoupment: 0,
          totalApplied: 0,
        };
        bucket.total += 1;
        if (child.claim_match_status === "matched") bucket.matched += 1;
        else bucket.unmatched += 1;
        if (child.posting_status === "blocked") bucket.blocked += 1;
        if (child.posting_status === "posted") {
          bucket.posted += 1;
          bucket.totalApplied += asNumber(child.clp04_payment_amount);
        }
        if (child.clp02_claim_status_code === "4") bucket.denied += 1;
        if (asNumber(child.clp04_payment_amount) < 0) bucket.recoupment += 1;
        childMap.set(child.era_import_batch_id, bucket);
      }
    }

    const items = rows.map((row) => {
      const agg = childMap.get(row.id) ?? {
        total: row.total_claims ?? 0,
        matched: 0,
        unmatched: 0,
        blocked: 0,
        posted: 0,
        denied: 0,
        recoupment: 0,
        totalApplied: 0,
      };
      const totalPayment = asNumber(row.total_payment_amount);
      const totalApplied = +agg.totalApplied.toFixed(2);
      const unallocated = +(totalPayment - totalApplied).toFixed(2);
      const deferred =
        row.parsed_summary && typeof row.parsed_summary === "object"
          ? Boolean((row.parsed_summary as Record<string, unknown>).deferred)
          : false;
      const markedDuplicateOf = readString(row.parsed_summary, "marked_duplicate_of");
      const assignedBiller = readString(row.parsed_summary, "assigned_biller_name");
      return {
        id: row.id,
        source: row.source,
        fileName: row.file_name,
        importStatus: row.import_status,
        payer: {
          identifier: row.payer_identifier,
          name: row.payer_name ?? readString(row.parsed_summary, "payer") ?? "Unknown payer",
        },
        eftOrCheckNumber: row.eft_or_check_number,
        paymentMethodCode: row.payment_method_code,
        paymentDate: row.payment_date,
        receivedAt: row.imported_at,
        totalPaymentAmount: totalPayment,
        totalPatientResponsibility: asNumber(row.total_patient_responsibility),
        totalAllocated: totalApplied,
        unallocated,
        counts: {
          total: agg.total,
          matched: agg.matched,
          unmatched: agg.unmatched,
          blocked: agg.blocked,
          posted: agg.posted,
          denied: agg.denied,
          recoupment: agg.recoupment,
        },
        archivedAt: row.archived_at,
        deferred,
        markedDuplicateOf,
        assignedBiller,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    return NextResponse.json({ success: true, organizationId, items });
  } catch (error) {
    console.error("ERA batches API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "ERA batches API failed" },
      { status: 500 },
    );
  }
}
