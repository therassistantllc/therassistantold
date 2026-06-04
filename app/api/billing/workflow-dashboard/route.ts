import { NextResponse } from "next/server";
import { createServerSupabaseAdminClient } from "@/lib/supabase/server";

type SupabaseAdminClient = NonNullable<ReturnType<typeof createServerSupabaseAdminClient>>;

async function countRows(supabase: SupabaseAdminClient, table: string, filters: Record<string, string>) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  for (const [field, value] of Object.entries(filters)) {
    query = query.eq(field, value);
  }

  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

async function countWorkqueue(supabase: SupabaseAdminClient, organizationId: string, workType: string) {
  const { count, error } = await supabase
    .from("workqueue_items")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("work_type", workType)
    .in("status", ["open", "in_progress", "blocked"])
    .is("archived_at", null);

  if (error) return 0;
  return count ?? 0;
}

async function countByValues(
  supabase: SupabaseAdminClient,
  values: string[],
  table: string,
  organizationId: string,
  field: string,
) {
  const entries = await Promise.all(
    values.map(async (value) => [
      value,
      await countRows(supabase, table, { organization_id: organizationId, [field]: value }),
    ] as const),
  );
  return Object.fromEntries(entries) as Record<string, number>;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json({ success: false, error: "organizationId is required" }, { status: 400 });
    }

    const supabase = createServerSupabaseAdminClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: "Database connection not available" }, { status: 500 });
    }

    const claimStatuses = [
      "ready_for_validation",
      "validation_failed",
      "ready_for_batch",
      "batched",
      "submitted",
      "accepted_oa",
      "rejected_oa",
      "accepted_payer",
      "rejected_payer",
      "paid",
      "denied",
    ];

    const batchStatuses = [
      "generated",
      "submitted",
      "accepted_999",
      "rejected_999",
      "accepted_277ca",
      "rejected_277ca",
      "partially_accepted",
      "failed",
    ];

    const eraImportStatuses = ["uploaded", "parsed", "matched", "posted", "blocked", "failed"];
    const eraMatchStatuses = ["matched", "unmatched", "ambiguous"];
    const eraPostingStatuses = ["ready", "posted", "blocked", "skipped"];
    const invoiceStatuses = ["draft", "open", "sent", "paid", "voided", "collections"];

    const [claimCounts, batchCounts, eraImportCounts, eraMatchCounts, eraPostingCounts, patientInvoiceCounts, workqueueEntries] =
      await Promise.all([
        countByValues(supabase, claimStatuses, "professional_claims", organizationId, "claim_status"),
        countByValues(supabase, batchStatuses, "edi_batches", organizationId, "status"),
        countByValues(supabase, eraImportStatuses, "era_import_batches", organizationId, "import_status"),
        countByValues(supabase, eraMatchStatuses, "era_claim_payments", organizationId, "claim_match_status"),
        countByValues(supabase, eraPostingStatuses, "era_claim_payments", organizationId, "posting_status"),
        countByValues(supabase, invoiceStatuses, "patient_invoices", organizationId, "invoice_status"),
        Promise.all(
          ["no_response", "clearinghouse_rejection", "payer_rejection", "denied", "eligibility_needed", "payment_posting_needed"].map(
            async (workType) => [workType, await countWorkqueue(supabase, organizationId, workType)] as const,
          ),
        ),
      ]);

    const workqueueCounts = Object.fromEntries(workqueueEntries) as Record<string, number>;

    return NextResponse.json({
      success: true,
      organizationId,
      claimCounts,
      batchCounts,
      eraImportCounts,
      eraMatchCounts,
      eraPostingCounts,
      patientInvoiceCounts,
      workqueueCounts,
      totals: {
        needsBillingAction:
          claimCounts.validation_failed +
          claimCounts.rejected_oa +
          claimCounts.rejected_payer +
          claimCounts.denied +
          eraMatchCounts.unmatched +
          eraMatchCounts.ambiguous +
          eraPostingCounts.blocked +
          workqueueCounts.no_response +
          workqueueCounts.clearinghouse_rejection +
          workqueueCounts.payer_rejection +
          workqueueCounts.denied,
        readyToSend: claimCounts.ready_for_batch,
        waitingForResponse: claimCounts.submitted + claimCounts.accepted_oa,
        payerAccepted: claimCounts.accepted_payer,
        eraNeedsPosting: eraPostingCounts.ready,
        openPatientInvoices: patientInvoiceCounts.open + patientInvoiceCounts.sent + patientInvoiceCounts.collections,
      },
    });
  } catch (error) {
    console.error("Billing workflow dashboard API error:", error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Billing workflow dashboard failed" },
      { status: 500 },
    );
  }
}
